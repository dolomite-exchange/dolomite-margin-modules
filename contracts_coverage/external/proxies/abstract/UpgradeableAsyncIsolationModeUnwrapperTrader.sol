// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AsyncIsolationModeTraderBase } from "./AsyncIsolationModeTraderBase.sol";
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { IFreezableIsolationModeVaultFactory } from "../../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeTokenVaultV1 } from "../../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "../../interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
import { IIsolationModeVaultFactory } from "../../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; //solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { AsyncIsolationModeUnwrapperTraderImpl } from "./impl/AsyncIsolationModeUnwrapperTraderImpl.sol";

/**
 * @title   UpgradeableAsyncIsolationModeUnwrapperTrader
 * @author  Dolomite
 *
 * @notice  Abstract contract for selling a vault token into the underlying token. Must be set as a token converter by
 *          the DolomiteMargin admin on the corresponding `IsolationModeVaultFactory` token to be used.
 */
abstract contract UpgradeableAsyncIsolationModeUnwrapperTrader is
    IUpgradeableAsyncIsolationModeUnwrapperTrader,
    AsyncIsolationModeTraderBase
{
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "UpgradeableUnwrapperTraderV2";
    uint256 private constant _ACTIONS_LENGTH = 2;

    // ======================== Field Variables ========================

    bytes32 private constant _ACTIONS_LENGTH_SLOT = bytes32(uint256(keccak256("eip1967.proxy.actionsLength")) - 1);
    bytes32 private constant _REENTRANCY_GUARD_SLOT = bytes32(uint256(keccak256("eip1967.proxy.reentrancyGuard")) - 1);
    bytes32 private constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);
    bytes32 private constant _WITHDRAWAL_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.withdrawalInfo")) - 1);
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 internal constant _ACTIONS_LENGTH_NORMAL = 4;
    uint256 internal constant _ACTIONS_LENGTH_CALLBACK = 2;

    // ======================== Modifiers ========================

    modifier nonReentrant() {
        // On the first call to nonReentrant, _reentrancyGuard will be _NOT_ENTERED
        _validateNotReentered();

        // Any calls to nonReentrant after this point will fail
        _setReentrancyGuard(_ENTERED);

        _;

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200)
        _setReentrancyGuard(_NOT_ENTERED);
    }

    // ======================== External Functions ========================

    function executeWithdrawalForRetry(bytes32 _key) external onlyHandler(msg.sender) nonReentrant {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        _validateWithdrawalExists(withdrawalInfo);
        _validateIsRetryable(withdrawalInfo.isRetryable);
        _executeWithdrawal(withdrawalInfo);
    }

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    external
    virtual
    onlyDolomiteMargin(msg.sender)
    onlyDolomiteMarginGlobalOperator(_sender) {
        _callFunction(_sender, _accountInfo, _data);
    }

    function exchange(
        address _tradeOriginator,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    virtual
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        if (_inputToken == address(VAULT_FACTORY())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (isValidOutputToken(_outputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount, bytes memory extraOrderData) = abi.decode(_orderData, (uint256, bytes));

        _validateIsBalanceSufficient(_inputAmount);

        uint256 outputAmount = _exchangeUnderlyingTokenToOutputToken(
            _tradeOriginator,
            _receiver,
            _outputToken,
            minOutputAmount,
            address(VAULT_FACTORY()),
            _inputAmount,
            extraOrderData
        );
        if (outputAmount >= minOutputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output amount",
            outputAmount,
            minOutputAmount
        );

        IERC20(_outputToken).safeApprove(_receiver, outputAmount);

        return outputAmount;
    }

    function token() external view returns (address) {
        return address(VAULT_FACTORY());
    }

    function createActionsForUnwrapping(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address /* _primaryAccountOwner */,
        address /* _otherAccountOwner */,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minAmountOut,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    virtual
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        return AsyncIsolationModeUnwrapperTraderImpl.createActionsForUnwrapping(
            /* _unwrapper = */ this,
            _solidAccountId,
            _liquidAccountId,
            _outputMarket,
            _inputMarket,
            _minAmountOut,
            _inputAmount,
            _orderData
        );
    }

    function actionsLength()
        public
        virtual
        view
        returns (uint256)
    {
        return _getUint256(_ACTIONS_LENGTH_SLOT);
    }

    function isValidOutputToken(address _outputToken) public override virtual view returns (bool);

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory _orderData
    )
    public
    override
    view
    returns (uint256) {
        if (_inputToken == address(VAULT_FACTORY())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (isValidOutputToken(_outputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        return _getExchangeCost(
            _inputToken,
            _outputToken,
            _desiredInputAmount,
            _orderData
        );
    }

    function VAULT_FACTORY() public view returns (IIsolationModeVaultFactory) {
        return IIsolationModeVaultFactory(_getAddress(_VAULT_FACTORY_SLOT));
    }

    // ============ Internal Functions ============

    function _initializeUnwrapperTrader(
        address _vaultFactory,
        address _dolomiteMargin
    ) internal initializer {
        _setVaultFactory(_vaultFactory);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
        _setReentrancyGuard(_NOT_ENTERED);
        _setActionsLength(_ACTIONS_LENGTH_NORMAL);
    }

    function _vaultCreateWithdrawalInfo(
        bytes32 _key,
        address _vault,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    ) internal {

        // Panic if the key is already used
        /*assert(_getWithdrawalSlot(_key).vault == address(0));*/

        WithdrawalInfo memory withdrawalInfo = WithdrawalInfo({
            key: _key,
            vault: _vault,
            accountNumber: _accountNumber,
            inputAmount: _inputAmount,
            outputToken: _outputToken,
            outputAmount: _minOutputAmount,
            isRetryable: false
        });
        _setWithdrawalInfo(_key, withdrawalInfo);
        _updateVaultPendingAmount(_vault, _accountNumber, _inputAmount, /* _isPositive = */ true, _outputToken);
        _eventEmitter().emitAsyncWithdrawalCreated(
            _key,
            address(VAULT_FACTORY()),
            withdrawalInfo
        );
    }

    function _handleCallbackBefore() internal {
        _setActionsLength(_ACTIONS_LENGTH_CALLBACK);
    }

    function _handleCallbackAfter() internal {
        _setActionsLength(_ACTIONS_LENGTH_NORMAL);
    }

    function _executeWithdrawal(WithdrawalInfo memory _withdrawalInfo) internal virtual {
        try AsyncIsolationModeUnwrapperTraderImpl.swapExactInputForOutputForWithdrawal(
            /* _unwrapper = */ this,
            _withdrawalInfo
        ) {
            _eventEmitter().emitAsyncWithdrawalExecuted(
                _withdrawalInfo.key,
                address(VAULT_FACTORY())
            );
        } catch Error(string memory _reason) {
            _eventEmitter().emitAsyncWithdrawalFailed(
                _withdrawalInfo.key,
                address(VAULT_FACTORY()),
                _reason
            );
        } catch (bytes memory /* _reason */) {
            _eventEmitter().emitAsyncWithdrawalFailed(
                _withdrawalInfo.key,
                address(VAULT_FACTORY()),
                /* _reason =  */ ""
            );
        }
    }

    function _executeWithdrawalCancellation(bytes32 _key) internal virtual {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        _validateWithdrawalExists(withdrawalInfo);

        IIsolationModeVaultFactory factory = VAULT_FACTORY();
        IERC20(factory.UNDERLYING_TOKEN()).safeTransfer(
            withdrawalInfo.vault,
            withdrawalInfo.inputAmount
        );

        _updateVaultPendingAmount(
            withdrawalInfo.vault,
            withdrawalInfo.accountNumber,
            withdrawalInfo.inputAmount,
            /* _isPositive = */ false,
            withdrawalInfo.outputToken
        );

        // Setting inputAmount to 0 will clear the withdrawal
        withdrawalInfo.inputAmount = 0;
        _setWithdrawalInfo(_key, withdrawalInfo);
        _eventEmitter().emitAsyncWithdrawalCancelled(_key, address(factory));
    }

    function _callFunction(
        address /* _sender */,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    ) internal virtual {
        IFreezableIsolationModeVaultFactory factory = IFreezableIsolationModeVaultFactory(address(VAULT_FACTORY()));
        _validateVaultExists(factory, _accountInfo.owner);

        (
            uint256 transferAmount,
            TradeType[] memory tradeTypes,
            bytes32[] memory keys
        ) = abi.decode(_data, (uint256, TradeType[], bytes32[]));
        /*assert(tradeTypes.length == keys.length && keys.length > 0);*/

        address vault;
        uint256 inputAmount;
        for (uint256 i; i < tradeTypes.length; ++i) {
            uint256 inputAmountForIteration;
            if (tradeTypes[i] == TradeType.FromWithdrawal) {
                WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(keys[i]);
                vault = withdrawalInfo.vault;
                inputAmountForIteration = withdrawalInfo.inputAmount;
            } else {
                /*assert(tradeTypes[i] == TradeType.FromDeposit);*/
                IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo memory depositInfo =
                                        _getWrapperTrader().getDepositInfo(keys[i]);

                vault = depositInfo.vault;
                inputAmountForIteration = depositInfo.outputAmount;
            }

            // Require that the vault is either the account owner or the input amount is 0 (meaning, it has been fully
            // spent)
            if ((inputAmountForIteration == 0 && vault == address(0)) || vault == _accountInfo.owner) { /* FOR COVERAGE TESTING */ }
            Require.that(
                (inputAmountForIteration == 0 && vault == address(0)) || vault == _accountInfo.owner,
                _FILE,
                "Invalid account owner",
                _accountInfo.owner
            );
            inputAmount += inputAmountForIteration;
        }

        uint256 underlyingVirtualBalance = IIsolationModeTokenVaultV1WithFreezable(vault).virtualBalance();
        if (underlyingVirtualBalance >= transferAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            underlyingVirtualBalance >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingVirtualBalance,
            transferAmount
        );

        if (transferAmount > 0 && transferAmount <= inputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            transferAmount > 0 && transferAmount <= inputAmount,
            _FILE,
            "Invalid transfer amount"
        );

        factory.enqueueTransferFromDolomiteMargin(_accountInfo.owner, transferAmount);
        factory.setShouldVaultSkipTransfer(vault, /* _shouldSkipTransfer = */ true);
    }

    /**
     * @notice Performs the exchange from the Isolation Mode's underlying token to `_outputToken`.
     */
    function _exchangeUnderlyingTokenToOutputToken(
        address /* _tradeOriginator */,
        address /* _receiver */,
        address _outputToken,
        uint256 /* _minOutputAmount */,
        address /* _inputToken */,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
    internal
    virtual
    returns (uint256) {
        // We don't need to validate _tradeOriginator here because it is validated in _callFunction via the transfer
        // being enqueued (without it being enqueued, we'd never reach this point)

        (TradeType[] memory tradeTypes, bytes32[] memory keys) = abi.decode(_extraOrderData, (TradeType[], bytes32[]));
        /*assert(tradeTypes.length == keys.length && keys.length > 0);*/

        uint256 inputAmountNeeded = _inputAmount; // decays toward 0
        uint256 outputAmount;
        for (uint256 i; i < tradeTypes.length && inputAmountNeeded > 0; ++i) {
            bytes32 key = keys[i];
            if (tradeTypes[i] == TradeType.FromWithdrawal) {
                WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(key);
                if (withdrawalInfo.outputToken == address(0)) {
                    // If the withdrawal was spent already, skip it
                    continue;
                }
                _validateOutputTokenForExchange(withdrawalInfo.outputToken, _outputToken);

                (uint256 inputAmountToCollect, uint256 outputAmountToCollect) = _getAmountsToCollect(
                    /* _structInputAmount = */ withdrawalInfo.inputAmount,
                    inputAmountNeeded,
                    /* _structOutputAmount = */ withdrawalInfo.outputAmount
                );
                withdrawalInfo.inputAmount -= inputAmountToCollect;
                withdrawalInfo.outputAmount -= outputAmountToCollect;
                _setWithdrawalInfo(key, withdrawalInfo);
                _updateVaultPendingAmount(
                    withdrawalInfo.vault,
                    withdrawalInfo.accountNumber,
                    inputAmountToCollect,
                    /* _isPositive = */ false,
                    withdrawalInfo.outputToken
                );

                inputAmountNeeded -= inputAmountToCollect;
                outputAmount = outputAmount + outputAmountToCollect;
            } else {
                // panic if the trade type isn't correct (somehow).
                /*assert(tradeTypes[i] == TradeType.FromDeposit);*/
                IUpgradeableAsyncIsolationModeWrapperTrader wrapperTrader = _getWrapperTrader();
                IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo memory depositInfo =
                                    wrapperTrader.getDepositInfo(key);
                if (depositInfo.inputToken == address(0)) {
                    // If the deposit was spent already, skip it
                    continue;
                }

                // The input token for a deposit is the output token in this case
                _validateOutputTokenForExchange(depositInfo.inputToken, _outputToken);

                (uint256 inputAmountToCollect, uint256 outputAmountToCollect) = _getAmountsToCollect(
                    /* _structInputAmount = */ depositInfo.outputAmount,
                    inputAmountNeeded,
                    /* _structOutputAmount = */ depositInfo.inputAmount
                );

                depositInfo.outputAmount -= inputAmountToCollect;
                depositInfo.inputAmount -= outputAmountToCollect;
                wrapperTrader.setDepositInfoAndReducePendingAmountFromUnwrapper(key, inputAmountToCollect, depositInfo);

                IERC20(depositInfo.inputToken).safeTransferFrom(
                    address(wrapperTrader),
                    address(this),
                    outputAmountToCollect
                );

                inputAmountNeeded -= inputAmountToCollect;
                outputAmount += outputAmountToCollect;
            }
        }

        // Panic if the developer didn't set this up to consume enough of the structs
        /*assert(inputAmountNeeded == 0);*/

        return outputAmount;
    }

    function _setActionsLength(uint256 _length) internal {
        _setUint256(_ACTIONS_LENGTH_SLOT, _length);
    }

    function _setWithdrawalInfo(bytes32 _key, WithdrawalInfo memory _info) internal {
        bool clearValues = _info.inputAmount == 0;
        WithdrawalInfo storage storageInfo = _getWithdrawalSlot(_key);
        storageInfo.key = _key;
        storageInfo.vault = clearValues ? address(0) : _info.vault;
        storageInfo.accountNumber = clearValues ? 0 : _info.accountNumber;
        storageInfo.inputAmount = clearValues ? 0 : _info.inputAmount;
        storageInfo.outputToken = clearValues ? address(0) : _info.outputToken;
        storageInfo.outputAmount = clearValues ? 0 : _info.outputAmount;
        storageInfo.isRetryable = clearValues ? false : _info.isRetryable;
    }

    function _updateVaultPendingAmount(
        address _vault,
        uint256 _accountNumber,
        uint256 _amountDeltaWei,
        bool _isPositive,
        address _outputToken
    ) internal {
        IFreezableIsolationModeVaultFactory(address(VAULT_FACTORY())).setVaultAccountPendingAmountForFrozenStatus(
            _vault,
            _accountNumber,
            IFreezableIsolationModeVaultFactory.FreezeType.Withdrawal,
            /* _amountWei = */ IDolomiteStructs.Wei({
                sign: _isPositive,
                value: _amountDeltaWei
            }),
            _outputToken
        );
    }

    function _validateVaultExists(IIsolationModeVaultFactory _factory, address _vault) internal view {
        if (_factory.getAccountByVault(_vault) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _factory.getAccountByVault(_vault) != address(0),
            _FILE,
            "Invalid vault",
            _vault
        );
    }

    function _getWrapperTrader() internal view returns (IUpgradeableAsyncIsolationModeWrapperTrader) {
        return HANDLER_REGISTRY().getWrapperByToken(VAULT_FACTORY());
    }

    function _validateIsBalanceSufficient(uint256 _inputAmount) internal virtual view {
        uint256 balance = IERC20(VAULT_FACTORY().UNDERLYING_TOKEN()).balanceOf(address(this));
        if (balance >= _inputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            balance >= _inputAmount,
            _FILE,
            "Insufficient input token",
            balance,
            _inputAmount
        );
    }

    function _getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory _orderData
    ) internal virtual view returns (uint256);

    function _validateWithdrawalExists(WithdrawalInfo memory _withdrawalInfo) internal pure {
        if (_withdrawalInfo.vault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );
    }

    function _getAmountsToCollect(
        uint256 _structInputAmount,
        uint256 _inputAmountNeeded,
        uint256 _structOutputAmount
    ) internal pure returns (uint256 _inputAmountToCollect, uint256 _outputAmountToCollect) {
        _inputAmountToCollect = _inputAmountNeeded < _structInputAmount
            ? _inputAmountNeeded
            : _structInputAmount;

        // Reduce output amount by the ratio of the collected input amount. Almost always the ratio will be
        // 100%. During liquidations, there will be a non-100% ratio because the user may not lose all
        // collateral to the liquidator.
        _outputAmountToCollect = _inputAmountNeeded < _structInputAmount
            ? _structOutputAmount * _inputAmountNeeded / _structInputAmount
            : _structOutputAmount;
    }

    function _getWithdrawalSlot(bytes32 _key) internal pure returns (WithdrawalInfo storage info) {
        bytes32 slot = keccak256(abi.encodePacked(_WITHDRAWAL_INFO_SLOT, _key));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            info.slot := slot
        }
    }

    // ============ Private Functions ============

    function _setVaultFactory(address _factory) private {
        _setAddress(_VAULT_FACTORY_SLOT, _factory);
    }

    function _setReentrancyGuard(uint256 _value) private {
        _setUint256(_REENTRANCY_GUARD_SLOT, _value);
    }

    function _validateNotReentered() private view {
        if (_getUint256(_REENTRANCY_GUARD_SLOT) != _ENTERED) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _getUint256(_REENTRANCY_GUARD_SLOT) != _ENTERED,
            _FILE,
            "Reentrant call"
        );
    }

    function _validateOutputTokenForExchange(
        address _structOutputToken,
        address _outputToken
    ) private pure {
        if (_structOutputToken == _outputToken) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _structOutputToken == _outputToken,
            _FILE,
            "Output token mismatch"
        );
    }
}
