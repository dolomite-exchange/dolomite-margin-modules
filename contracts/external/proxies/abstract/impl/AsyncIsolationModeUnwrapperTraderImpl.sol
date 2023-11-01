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
import { UpgradeableAsyncIsolationModeUnwrapperTrader } from "../UpgradeableAsyncIsolationModeUnwrapperTrader.sol";
import { UpgradeableAsyncIsolationModeWrapperTrader } from "../UpgradeableAsyncIsolationModeWrapperTrader.sol";
import { IDolomiteMargin } from "../../../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../../../protocol/lib/Require.sol";
import { IGenericTraderBase } from "../../../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../../../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeTokenVaultV1 } from "../../../interfaces/IIsolationModeTokenVaultV1.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../../../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../../../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "../../../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../../../lib/AccountBalanceLib.sol";


/**
 * @title   AsyncIsolationModeUnwrapperTraderImpl
 * @author  Dolomite
 *
 * Reusable library for functions that save bytecode on the async unwrapper/wrapper contracts
 */
library AsyncIsolationModeUnwrapperTraderImpl {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "AsyncIsolationModeUnwrapperImpl";
    uint256 private constant _ACTIONS_LENGTH_NORMAL = 4;

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function swapExactInputForOutputForWithdrawal(
        UpgradeableAsyncIsolationModeUnwrapperTrader _unwrapper,
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory _withdrawalInfo
    ) external {
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = _unwrapper.VAULT_FACTORY().marketId();
        marketIdsPath[1] = _unwrapper.DOLOMITE_MARGIN().getMarketIdByTokenAddress(_withdrawalInfo.outputToken);

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(this);

        IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[] memory tradeTypes = new IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[](1); // solhint-disable-line max-line-length
        tradeTypes[0] = IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType.FromWithdrawal;
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = _withdrawalInfo.key;
        traderParams[0].tradeData = abi.encode(tradeTypes, keys);

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: AccountBalanceLib.BalanceCheckFlag.None
        });

        IIsolationModeTokenVaultV1(_withdrawalInfo.vault).swapExactInputForOutput(
            _withdrawalInfo.accountNumber,
            marketIdsPath,
            _withdrawalInfo.inputAmount,
            _withdrawalInfo.outputAmount,
            traderParams,
            /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
            userConfig
        );
    }

    function createActionsForUnwrapping(
        UpgradeableAsyncIsolationModeUnwrapperTrader _unwrapper,
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minAmountOut,
        uint256 _inputAmount,
        bytes calldata _orderData
    ) external view returns (IDolomiteMargin.ActionArgs[] memory) {
        {
            IDolomiteMargin dolomiteMargin = _unwrapper.DOLOMITE_MARGIN();
            Require.that(
                dolomiteMargin.getMarketTokenAddress(_inputMarket) == address(_unwrapper.VAULT_FACTORY()),
                _FILE,
                "Invalid input market",
                _inputMarket
            );
            Require.that(
                _unwrapper.isValidOutputToken(dolomiteMargin.getMarketTokenAddress(_outputMarket)),
                _FILE,
                "Invalid output market",
                _outputMarket
            );
        }

        (
            IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[] memory tradeTypes,
            bytes32[] memory keys
        ) = abi.decode(_orderData, (IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[], bytes32[]));
        Require.that(
            tradeTypes.length == keys.length && keys.length > 0,
            _FILE,
            "Invalid unwrapping order data"
        );

        bool[] memory isRetryableList = new bool[](tradeTypes.length);
        uint256 structInputAmount = 0;
        // Realistically this array length will only ever be 1 or 2.
        for (uint256 i; i < tradeTypes.length; ++i) {
            // The withdrawal/deposit is authenticated & validated later in `_callFunction`
            if (tradeTypes[i] == IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType.FromWithdrawal) {
                IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory withdrawalInfo =
                                    _unwrapper.getWithdrawalInfo(keys[i]);
                structInputAmount += withdrawalInfo.inputAmount;
                isRetryableList[i] = withdrawalInfo.isRetryable;
            } else {
                assert(tradeTypes[i] == IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType.FromDeposit);
                UpgradeableAsyncIsolationModeUnwrapperTrader unwrapperForStackTooDeep = _unwrapper;
                IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo memory depositInfo =
                                        _getWrapperTrader(unwrapperForStackTooDeep).getDepositInfo(keys[i]);
                // The output amount for a deposit is the input amount for an unwrapping
                structInputAmount += depositInfo.outputAmount;
                isRetryableList[i] = depositInfo.isRetryable;
            }
        }
        Require.that(
            structInputAmount >= _inputAmount && _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // If the input amount doesn't match, we need to add 2 actions to settle the difference
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_unwrapper.actionsLength());

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
            // We need to spend the whole withdrawal amount, so we need to add an extra sale to spend the difference.
            // This can only happen during a liquidation
            for (uint256 i; i < isRetryableList.length; ++i) {
                Require.that(
                    isRetryableList[i],
                    _FILE,
                    "All trades must be retryable"
                );
            }

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

    // ===================================================
    // ================ Private Functions ================
    // ===================================================

    function _getWrapperTrader(
        UpgradeableAsyncIsolationModeUnwrapperTrader _unwrapper
    ) private view returns (IUpgradeableAsyncIsolationModeWrapperTrader) {
        return _unwrapper.HANDLER_REGISTRY().getWrapperByToken(_unwrapper.VAULT_FACTORY());
    }
}
