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
import { IGenericTraderBase } from "../../../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../../../interfaces/IGenericTraderProxyV1.sol";
import { AccountActionLib } from "../../../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../../../lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { IAsyncFreezableIsolationModeVaultFactory } from "../../interfaces/IAsyncFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeTokenVaultV1 } from "../../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeWrapperTraderV2 } from "../../interfaces/IIsolationModeWrapperTraderV2.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length


/**
 * @title   AsyncIsolationModeWrapperTraderImpl
 * @author  Dolomite
 *
 * Reusable library for functions that save bytecode on the async unwrapper/wrapper contracts
 */
library AsyncIsolationModeWrapperTraderImpl {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "AsyncIsolationModeWrapperImpl";

    // ===================================================
    // ==================== Functions ====================
    // ===================================================


    function swapExactInputForOutputForDepositCancellation(
        UpgradeableAsyncIsolationModeWrapperTrader _wrapper,
        IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo calldata _depositInfo
    ) external {
        IAsyncFreezableIsolationModeVaultFactory factory = IAsyncFreezableIsolationModeVaultFactory(
            address(_wrapper.VAULT_FACTORY())
        );
        factory.setShouldVaultSkipTransfer(_depositInfo.vault, /* _shouldSkipTransfer = */ true);

        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = factory.marketId();
        marketIdsPath[1] = _wrapper.DOLOMITE_MARGIN().getMarketIdByTokenAddress(_depositInfo.inputToken);

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(_wrapper.HANDLER_REGISTRY().getUnwrapperByToken(factory));

        IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[] memory tradeTypes = new IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[](1); // solhint-disable-line max-line-length
        tradeTypes[0] = IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType.FromDeposit;
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = _depositInfo.key;
        traderParams[0].tradeData = abi.encode(tradeTypes, keys);

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: AccountBalanceLib.BalanceCheckFlag.None,
            eventType: IGenericTraderProxyV1.EventEmissionType.None
        });

        uint256 outputAmount = _depositInfo.inputAmount;

        UpgradeableAsyncIsolationModeUnwrapperTrader(payable(traderParams[0].trader)).handleCallbackFromWrapperBefore();
        if (_depositInfo.accountNumber == 0) {
            IIsolationModeTokenVaultV1(_depositInfo.vault).swapExactInputForOutputAndRemoveCollateral(
                /* _toAccountNumber = */ 0,
                /* _borrowAccountNumber = */ 0,
                marketIdsPath,
                /* _inputAmountWei = */ _depositInfo.outputAmount,
                outputAmount,
                traderParams,
                /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
                userConfig
            );
        } else {
            IIsolationModeTokenVaultV1(_depositInfo.vault).swapExactInputForOutput(
                _depositInfo.accountNumber,
                marketIdsPath,
                /* _inputAmountWei = */ _depositInfo.outputAmount,
                outputAmount,
                traderParams,
                /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
                userConfig
            );
        }
        UpgradeableAsyncIsolationModeUnwrapperTrader(payable(traderParams[0].trader)).handleCallbackFromWrapperAfter();
    }

    function createActionsForWrapping(
        UpgradeableAsyncIsolationModeWrapperTrader _wrapper,
        IIsolationModeWrapperTraderV2.CreateActionsForWrappingParams calldata _params
    ) external view returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin dolomiteMargin = _wrapper.DOLOMITE_MARGIN();
        Require.that(
            _wrapper.isValidInputToken(dolomiteMargin.getMarketTokenAddress(_params.inputMarket)),
            _FILE,
            "Invalid input market",
            _params.inputMarket
        );
        Require.that(
            dolomiteMargin.getMarketTokenAddress(_params.outputMarket) == address(_wrapper.VAULT_FACTORY()),
            _FILE,
            "Invalid output market",
            _params.outputMarket
        );

        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_wrapper.actionsLength());

        actions[0] = AccountActionLib.encodeExternalSellAction(
            _params.primaryAccountId,
            _params.inputMarket,
            _params.outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _params.inputAmount,
            /* _amountOutMinWei = */ _params.minOutputAmount,
            _params.orderData
        );

        return actions;
    }

    function initializeWrapperTrader(
        IUpgradeableAsyncIsolationModeWrapperTrader.State storage _state,
        address _vaultFactory,
        address _handlerRegistry
    ) public {
        setVaultFactory(_state, _vaultFactory);
        setHandlerRegistry(_state, _handlerRegistry);
    }

    function setVaultFactory(
        IUpgradeableAsyncIsolationModeWrapperTrader.State storage _state,
        address _vaultFactory
    ) public {
        _state.vaultFactory = _vaultFactory;
    }

    function setHandlerRegistry(
        IUpgradeableAsyncIsolationModeWrapperTrader.State storage _state,
        address _handlerRegistry
    ) public {
        _state.handlerRegistry = _handlerRegistry;
    }

    function setDepositInfo(
        IUpgradeableAsyncIsolationModeWrapperTrader.State storage _state,
        bytes32 _key,
        IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo memory _depositInfo
    ) public {
        if (_depositInfo.outputAmount == 0) {
            delete _state.depositInfo[_key];
        } else {
            _state.depositInfo[_key] = _depositInfo;
        }
    }
}
