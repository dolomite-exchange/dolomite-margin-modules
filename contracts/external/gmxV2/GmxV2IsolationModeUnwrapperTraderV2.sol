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

import { GmxV2IsolationModeTraderBase } from "./GmxV2IsolationModeTraderBase.sol";
import { GmxV2Library } from "./GmxV2Library.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IFreezableIsolationModeVaultFactory } from "../interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeUnwrapperTrader } from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import { GmxEventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { GmxWithdrawal } from "../interfaces/gmx/GmxWithdrawal.sol";
import { IGmxV2IsolationModeTokenVaultV1 } from "../interfaces/gmx/IGmxV2IsolationModeTokenVaultV1.sol";
import { IGmxV2IsolationModeUnwrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeUnwrapperTraderV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeWrapperTraderV2.sol";
import { IGmxWithdrawalCallbackReceiver } from "../interfaces/gmx/IGmxWithdrawalCallbackReceiver.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { UpgradeableIsolationModeUnwrapperTrader } from "../proxies/abstract/UpgradeableIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length


/**
 * @title   GmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GMX GM (via withdrawing from GMX)
 */
contract GmxV2IsolationModeUnwrapperTraderV2 is
    IGmxV2IsolationModeUnwrapperTraderV2,
    UpgradeableIsolationModeUnwrapperTrader,
    GmxV2IsolationModeTraderBase,
    IGmxWithdrawalCallbackReceiver
{

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeUnwrapperV2";
    bytes32 private constant _WITHDRAWAL_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.withdrawalInfo")) - 1);
    bytes32 private constant _ACTIONS_LENGTH_SLOT = bytes32(uint256(keccak256("eip1967.proxy.actionsLength")) - 1);
    uint256 private constant _ACTIONS_LENGTH_NORMAL = 4;
    uint256 private constant _ACTIONS_LENGTH_CALLBACK = 2;

    // ============ Modifiers ============

    modifier handleGmxCallback() {
        // For GMX callbacks, we restrict the # of actions to use less gas
        _setUint256(_ACTIONS_LENGTH_SLOT, _ACTIONS_LENGTH_CALLBACK);
        _;
        _setUint256(_ACTIONS_LENGTH_SLOT, _ACTIONS_LENGTH_NORMAL);
    }

    // ============ Constructor ============

    receive() external payable {} // solhint-disable-line no-empty-blocks

    // ============ Initializer ============

    function initialize(
        address _dGM,
        address _dolomiteMargin,
        address _gmxRegistryV2,
        address _weth
    )
    external initializer {
        _initializeUnwrapperTrader(_dGM, _dolomiteMargin);
        _initializeTraderBase(_gmxRegistryV2, _weth);
        _setUint256(_ACTIONS_LENGTH_SLOT, _ACTIONS_LENGTH_NORMAL);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function afterWithdrawalExecution(
        bytes32 _key,
        GmxWithdrawal.WithdrawalProps memory _withdrawal,
        GmxEventUtils.EventLogData memory _eventData
    )
    external
    nonReentrant
    handleGmxCallback
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        Require.that(
            withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );
        Require.that(
            withdrawalInfo.inputAmount == _withdrawal.numbers.marketTokenAmount,
            _FILE,
            "Invalid market token amount"
        );

        GmxEventUtils.AddressKeyValue memory outputTokenAddress = _eventData.addressItems.items[0];
        GmxEventUtils.AddressKeyValue memory secondaryOutputTokenAddress = _eventData.addressItems.items[1];
        GmxEventUtils.UintKeyValue memory outputTokenAmount = _eventData.uintItems.items[0];
        GmxEventUtils.UintKeyValue memory secondaryOutputTokenAmount = _eventData.uintItems.items[1];
        GmxV2Library.validateEventDataForWithdrawal(
            outputTokenAddress,
            outputTokenAmount,
            secondaryOutputTokenAddress,
            secondaryOutputTokenAmount,
            withdrawalInfo
        );

        // @audit:  If GMX changes the keys OR if the data sent back is malformed (causing the above requires to
        //          fail), this will fail. This will result in us receiving tokens from GMX and not knowing who they
        //          are for, nor the amount. The only solution will be to upgrade this contract and have an admin
        //          "unstuck" the funds for users by sending them to the appropriate vaults.


        // Save the output amount so we can refer to it later
        withdrawalInfo.outputAmount = outputTokenAmount.value + secondaryOutputTokenAmount.value;
        _setWithdrawalInfoAndSetVaultFrozenStatus(_key, withdrawalInfo);

        {
            // Change scope for the "stack too deep" error
            IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
            uint256 pendingDepositAmount = factory.getPendingAmountByAccount(
                withdrawalInfo.vault,
                withdrawalInfo.accountNumber,
                IFreezableIsolationModeVaultFactory.FreezeType.Deposit
            );
            if (pendingDepositAmount != 0) {
                // If there's a pending deposit, we defer it, so the liquidation bot so we can process them all
                emit WithdrawalDeferred(_key);
                return;
            }
        }

        try GmxV2Library.swapExactInputForOutput(this, withdrawalInfo) {
            _setWithdrawalInfoAndSetVaultFrozenStatus(
                _key,
                _emptyWithdrawalInfo(_key, withdrawalInfo.vault, withdrawalInfo.accountNumber)
            );
            emit WithdrawalExecuted(_key);
        } catch Error(string memory _reason) {
            emit WithdrawalFailed(_key, _reason);
        } catch (bytes memory /* _reason */) {
            emit WithdrawalFailed(_key, "");
        }
    }

    /**
     * @dev Funds will automatically be sent back to the vault by GMX
     */
    function afterWithdrawalCancellation(
        bytes32 _key,
        GmxWithdrawal.WithdrawalProps memory /* _withdrawal */,
        GmxEventUtils.EventLogData memory /* _eventData */
    )
    external
    nonReentrant
    onlyHandler(msg.sender) {
        WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(_key);
        Require.that(
            withdrawalInfo.vault != address(0),
            _FILE,
            "Invalid withdrawal key"
        );

        // @audit - Is there a way for us to verify the tokens were sent back to the vault?
        _setWithdrawalInfoAndSetVaultFrozenStatus(
            _key,
            _emptyWithdrawalInfo(_key, withdrawalInfo.vault, withdrawalInfo.accountNumber)
        );
        emit WithdrawalCancelled(_key);
    }

    function vaultSetWithdrawalInfo(
        bytes32 _key,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken
    ) external {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        Require.that(
            factory.getAccountByVault(msg.sender) != address(0),
            _FILE,
            "Invalid vault"
        );

        // Panic if the key is already used
        assert(_getWithdrawalSlot(_key).vault == address(0));

        // Disallow the withdrawal if there's already a withdrawal waiting for it (or if we're attempting to OVER
        // withdraw)
        GmxV2Library.checkWithdrawalIsNotTooLargeAgainstPending(
            factory,
            DOLOMITE_MARGIN(),
            msg.sender,
            _accountNumber,
            _inputAmount
        );

        _setWithdrawalInfoAndSetVaultFrozenStatus(
            _key,
            WithdrawalInfo({
                key: _key,
                vault: msg.sender,
                accountNumber: _accountNumber,
                inputAmount: _inputAmount,
                outputToken: _outputToken,
                outputAmount: 0
            })
        );
        emit WithdrawalCreated(_key);
    }

    function createActionsForUnwrapping(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address,
        address,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minAmountOut,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    virtual
    override(UpgradeableIsolationModeUnwrapperTrader, IIsolationModeUnwrapperTrader)
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        Require.that(
            DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarket) == address(VAULT_FACTORY()),
            _FILE,
            "Invalid input market",
            _inputMarket
        );
        Require.that(
            isValidOutputToken(DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarket)),
            _FILE,
            "Invalid output market",
            _outputMarket
        );

        (TradeType[] memory tradeTypes, bytes32[] memory keys) = abi.decode(_orderData, (TradeType[], bytes32[]));
        Require.that(
            tradeTypes.length == keys.length && keys.length > 0,
            _FILE,
            "Invalid unwrapping order data"
        );

        uint256 structInputAmount = 0;
        // Realistically this array length will only ever be 1 or 2.
        for (uint256 i; i < tradeTypes.length; ++i) {
            if (tradeTypes[i] == TradeType.FromWithdrawal) {
                structInputAmount += _getWithdrawalSlot(keys[i]).inputAmount;
            } else {
                assert(tradeTypes[i] == TradeType.FromDeposit);
                structInputAmount += GMX_REGISTRY_V2().gmxV2WrapperTrader().getDepositInfo(keys[i]).outputAmount;
            }
        }
        Require.that(
            structInputAmount >= _inputAmount && _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // If the input amount doesn't match, we need to add 2 actions to settle the difference
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](actionsLength());

        // Transfer the IsolationMode tokens to this contract. Do this by enqueuing a transfer via the call to
        // `enqueueTransferFromDolomiteMargin` in `callFunction` on this contract.
        actions[0] = AccountActionLib.encodeCallAction(
            _liquidAccountId,
            /* _callee */ address(this),
            /* (transferAmount, tradeTypes, keys)[encoded] = */ abi.encode(_inputAmount, tradeTypes, keys)
        );
        actions[1] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarket,
            _outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ _minAmountOut,
            _orderData
        );
        if (actions.length == _ACTIONS_LENGTH_NORMAL) {
            // We need to spend the whole withdrawal amount, so we need to add an extra sales to spend the difference
            // This can only happen during a liquidation

            structInputAmount -= _inputAmount;
            actions[2] = AccountActionLib.encodeCallAction(
                _liquidAccountId,
                /* _callee */ address(this),
                /* (transferAmount, tradeTypes, keys)[encoded] = */ abi.encode(structInputAmount, tradeTypes, keys)
            );
            actions[3] = AccountActionLib.encodeExternalSellAction(
                _liquidAccountId,
                _inputMarket,
                _outputMarket,
                /* _trader = */ address(this),
                /* _amountInWei = */ structInputAmount,
                /* _amountOutMinWei = */ 1,
                _orderData
            );
        }

        return actions;
    }

    function actionsLength()
        public
        override(IIsolationModeUnwrapperTrader, UpgradeableIsolationModeUnwrapperTrader)
        view
        returns (uint256)
    {
        return _getUint256(_ACTIONS_LENGTH_SLOT);
    }

    function isValidOutputToken(
        address _outputToken
    )
    public
    view
    override(UpgradeableIsolationModeUnwrapperTrader, IIsolationModeUnwrapperTrader)
    returns (bool) {
        return GmxV2Library.isValidOutputToken(IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())), _outputToken);
    }

    function getWithdrawalInfo(bytes32 _key) public pure returns (WithdrawalInfo memory) {
        return _getWithdrawalSlot(_key);
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _callFunction(
        address /* _sender */,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    internal
    override {
        (
            uint256 transferAmount,
            TradeType[] memory tradeTypes,
            bytes32[] memory keys
        ) = abi.decode(_data, (uint256, TradeType[], bytes32[]));
        assert(tradeTypes.length == keys.length && keys.length > 0);

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY()));
        Require.that(
            factory.getAccountByVault(_accountInfo.owner) != address(0),
            _FILE,
            "Account owner is not a vault",
            _accountInfo.owner
        );

        address vault;
        uint256 inputAmount;
        for (uint256 i; i < tradeTypes.length; ++i) {
            if (tradeTypes[i] == TradeType.FromWithdrawal) {
                WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(keys[i]);
                vault = withdrawalInfo.vault;
                inputAmount += withdrawalInfo.inputAmount;
            } else {
                assert(tradeTypes[i] == TradeType.FromDeposit);
                IGmxV2IsolationModeWrapperTraderV2.DepositInfo memory depositInfo =
                                                GMX_REGISTRY_V2().gmxV2WrapperTrader().getDepositInfo(keys[i]);
                vault = depositInfo.vault;
                inputAmount += depositInfo.outputAmount;
            }
        }

        Require.that(
            vault == _accountInfo.owner,
            _FILE,
            "Invalid account owner"
        );
        Require.that(
            transferAmount > 0 && transferAmount <= inputAmount,
            _FILE,
            "Invalid transfer amount"
        );

        uint256 underlyingVirtualBalance = IGmxV2IsolationModeTokenVaultV1(_accountInfo.owner).virtualBalance();
        Require.that(
            underlyingVirtualBalance >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingVirtualBalance,
            transferAmount
        );

        factory.enqueueTransferFromDolomiteMargin(_accountInfo.owner, transferAmount);
        factory.setShouldSkipTransfer(vault, /* _shouldSkipTransfer = */ true);
    }

    function _exchangeUnderlyingTokenToOutputToken(
        address /* _tradeOriginator */,
        address /* _receiver */,
        address _outputToken,
        uint256 _minOutputAmount,
        address /* _inputToken */,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
    internal
    virtual
    override
    returns (uint256) {
        // We don't need to validate _tradeOriginator here because it is validated in _callFunction via the transfer
        // being enqueued (without it being enqueued, we'd never reach this point)

        (TradeType[] memory tradeTypes, bytes32[] memory keys) = abi.decode(_extraOrderData, (TradeType[], bytes32[]));
        assert(tradeTypes.length == keys.length && keys.length > 0);

        uint256 outputAmount = 0;
        for (uint256 i; i < tradeTypes.length; ++i) {
            bytes32 key = keys[i];
            if (tradeTypes[i] == TradeType.FromWithdrawal) {
                WithdrawalInfo memory withdrawalInfo = _getWithdrawalSlot(key);
                Require.that(
                    withdrawalInfo.inputAmount >= _inputAmount,
                    _FILE,
                    "Invalid input amount"
                );
                Require.that(
                    withdrawalInfo.outputToken == _outputToken,
                    _FILE,
                    "Invalid output token"
                );
                Require.that(
                    withdrawalInfo.outputAmount >= _minOutputAmount,
                    _FILE,
                    "Invalid output amount"
                );
                // Reduce output amount by the size of the ratio of the input amount. Almost always the ratio will be
                // 100%. During liquidations, there will be a non-100% ratio because the user may not lose all
                // collateral to the liquidator.
                outputAmount = outputAmount + (withdrawalInfo.outputAmount * _inputAmount / withdrawalInfo.inputAmount);
                withdrawalInfo.inputAmount -= _inputAmount;
                withdrawalInfo.outputAmount -= outputAmount;
                _setWithdrawalInfoAndSetVaultFrozenStatus(key, withdrawalInfo);
            } else {
                // panic if the trade type isn't correct (somehow).
                assert(tradeTypes[i] == TradeType.FromDeposit);
                IGmxV2IsolationModeWrapperTraderV2 wrapperTrader = GMX_REGISTRY_V2().gmxV2WrapperTrader();
                IGmxV2IsolationModeWrapperTraderV2.DepositInfo memory depositInfo = wrapperTrader.getDepositInfo(key);
                // The outputAmount for a deposit is the input amount in this case
                Require.that(
                    depositInfo.outputAmount >= _inputAmount,
                    _FILE,
                    "Invalid input amount"
                );
                // The input token for a deposit is the output token in this case
                Require.that(
                    depositInfo.inputToken == _outputToken,
                    _FILE,
                    "Invalid output token"
                );
                Require.that(
                    depositInfo.inputAmount >= _minOutputAmount,
                    _FILE,
                    "Invalid output amount"
                );
                // Reduce output amount by the size of the ratio of the input amount. Almost always the ratio will be
                // 100%. During liquidations, there will be a non-100% ratio because the user may not lose all
                // collateral to the liquidator.
                outputAmount = outputAmount + (depositInfo.inputAmount * _inputAmount / depositInfo.outputAmount);
                depositInfo.outputAmount -= _inputAmount;
                depositInfo.inputAmount -= outputAmount;
                wrapperTrader.setDepositInfoAndSetVaultFrozenStatus(key, depositInfo);
            }
        }

        return outputAmount;
    }

    function _setWithdrawalInfoAndSetVaultFrozenStatus(bytes32 _key, WithdrawalInfo memory _info) internal {
        bool clearValues = _info.inputAmount == 0;
        IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY())).setIsVaultAccountFrozen(
            _info.vault,
            _info.accountNumber,
            IFreezableIsolationModeVaultFactory.FreezeType.Withdrawal,
            /* _amountWei = */ _info.inputAmount
        );

        WithdrawalInfo storage storageInfo = _getWithdrawalSlot(_key);
        storageInfo.key = _key;
        storageInfo.vault = clearValues ? address(0) : _info.vault;
        storageInfo.accountNumber = clearValues ? 0 : _info.accountNumber;
        storageInfo.inputAmount = clearValues ? 0 : _info.inputAmount;
        storageInfo.outputToken = clearValues ? address(0) : _info.outputToken;
        storageInfo.outputAmount = clearValues ? 0 : _info.outputAmount;
    }

    function _requireBalanceIsSufficient(uint256 /* _inputAmount */) internal override view {
        // solhint-disable-previous-line no-empty-blocks
        // Do nothing
    }

    function _getWithdrawalSlot(bytes32 _key) internal pure returns (WithdrawalInfo storage info) {
        bytes32 slot = keccak256(abi.encodePacked(_WITHDRAWAL_INFO_SLOT, _key));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            info.slot := slot
        }
    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }

    function _emptyWithdrawalInfo(
        bytes32 _key,
        address _vault,
        uint256 _accountNumber
    ) internal pure returns (WithdrawalInfo memory) {
        return WithdrawalInfo({
            key: _key,
            vault: _vault,
            accountNumber: _accountNumber,
            inputAmount: 0,
            outputToken: address(0),
            outputAmount: 0
        });
    }
}
