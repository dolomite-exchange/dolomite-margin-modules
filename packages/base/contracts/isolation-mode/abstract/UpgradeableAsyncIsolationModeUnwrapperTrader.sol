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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IHandlerRegistry } from "../../interfaces/IHandlerRegistry.sol";
import { IIsolationModeUnwrapperTraderV2 } from "../interfaces/IIsolationModeUnwrapperTraderV2.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; //solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
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
    using AsyncIsolationModeUnwrapperTraderImpl for State;
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "UpgradeableUnwrapperTraderV2";
    uint256 private constant _ACTIONS_LENGTH = 2;
    uint256 internal constant _ACTIONS_LENGTH_NORMAL = 4;
    uint256 internal constant _ACTIONS_LENGTH_CALLBACK = 2;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // ======================== Field Variables ========================

    bytes32 private constant _STORAGE_STATE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.storageState")) - 1);

    // ======================== Modifiers ========================

    modifier nonReentrant() {
        State storage state = _getStorageSlot();
        // On the first call to nonReentrant, _reentrancyGuard will be _NOT_ENTERED
        state.validateNotReentered();

        // Any calls to nonReentrant after this point will fail
        state.setReentrancyGuard(_ENTERED);

        _;

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200)
        state.setReentrancyGuard(_NOT_ENTERED);
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
        State storage state = _getStorageSlot();
        state.callFunction(this, _sender, _accountInfo, _data);
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
        Require.that(
            _inputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount, bytes memory extraOrderData) = abi.decode(_orderData, (uint256, bytes));

        _validateIsBalanceSufficient(_inputAmount);

        uint256 outputAmount = _getStorageSlot().exchangeUnderlyingTokenToOutputToken(
            _tradeOriginator,
            _receiver,
            _outputToken,
            minOutputAmount,
            address(VAULT_FACTORY()),
            _inputAmount,
            extraOrderData
        );
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
        IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParams calldata _params
    )
    external
    virtual
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        return AsyncIsolationModeUnwrapperTraderImpl.createActionsForUnwrapping(
            /* _unwrapper = */ this,
            _params
        );
    }

    function actionsLength()
        public
        virtual
        view
        returns (uint256)
    {
        State storage state = _getStorageSlot();
        return state.actionsLength;
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
        Require.that(
            _inputToken == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
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
        State storage state = _getStorageSlot();
        return IIsolationModeVaultFactory(state.vaultFactory);
    }

    function HANDLER_REGISTRY() public view override returns (IHandlerRegistry) {
        State storage state = _getStorageSlot();
        return IHandlerRegistry(state.handlerRegistry);
    }

    // ============ Internal Functions ============

    function _initializeUnwrapperTrader(
        address _vaultFactory,
        address _handlerRegistry,
        address _dolomiteMargin
    ) internal initializer {
        State storage state = _getStorageSlot();
        state.initializeUnwrapperTrader(_vaultFactory, _handlerRegistry);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
    }

    function _vaultCreateWithdrawalInfo(
        bytes32 _key,
        address _vault,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) internal {

        // Panic if the key is already used
        assert(_getWithdrawalSlot(_key).vault == address(0));

        WithdrawalInfo memory withdrawalInfo = WithdrawalInfo({
            key: _key,
            vault: _vault,
            accountNumber: _accountNumber,
            inputAmount: _inputAmount,
            outputToken: _outputToken,
            outputAmount: _minOutputAmount,
            isLiquidation: _isLiquidation,
            isRetryable: false,
            extraData: _extraData
        });
        AsyncIsolationModeUnwrapperTraderImpl.setWithdrawalInfo(_getStorageSlot(), _key, withdrawalInfo);
        _updateVaultPendingAmount(_vault, _accountNumber, _inputAmount, /* _isPositive = */ true, _outputToken);
        _eventEmitter().emitAsyncWithdrawalCreated(
            _key,
            address(VAULT_FACTORY()),
            withdrawalInfo
        );
    }

    function _handleCallbackBefore() internal {
        State storage state = _getStorageSlot();
        state.setActionsLength(_ACTIONS_LENGTH_CALLBACK);
    }

    function _handleCallbackAfter() internal {
        State storage state = _getStorageSlot();
        state.setActionsLength(_ACTIONS_LENGTH_NORMAL);
    }

    function _executeWithdrawal(WithdrawalInfo memory _withdrawalInfo) internal virtual {
        State storage state = _getStorageSlot();
        try state.swapExactInputForOutputForWithdrawal(
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
        AsyncIsolationModeUnwrapperTraderImpl.setWithdrawalInfo(_getStorageSlot(), _key, withdrawalInfo);
        _eventEmitter().emitAsyncWithdrawalCancelled(_key, address(factory));
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

    function _getWithdrawalSlot(bytes32 _key) internal view returns (WithdrawalInfo storage info) {
        State storage state = _getStorageSlot();
        return state.withdrawalInfo[_key];
    }

    function _validateWithdrawalExists(WithdrawalInfo memory _withdrawalInfo) internal pure {
        Require.that(
            _withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );
    }

    function _getStorageSlot() internal pure returns (State storage state) {
        bytes32 slot = _STORAGE_STATE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            state.slot := slot
        }
    }
}
