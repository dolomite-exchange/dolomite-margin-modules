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
import { AccountBalanceLib } from "./AccountBalanceLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length
import { UpgradeableAsyncIsolationModeUnwrapperTrader } from "../proxies/abstract/UpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length
import { UpgradeableAsyncIsolationModeWrapperTrader } from "../proxies/abstract/UpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length


/**
 * @title   AsyncIsolationModeTraderLib
 * @author  Dolomite
 *
 * Reusable library for functions that save bytecode on the async unwrapper/wrapper contracts
 */
library AsyncIsolationModeTraderLib {
    using SafeERC20 for IERC20;

    function swapExactInputForOutputForWithdrawal(
        UpgradeableAsyncIsolationModeUnwrapperTrader _unwrapper,
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory _withdrawalInfo
    ) public {
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

    function swapExactInputForOutputForDepositCancellation(
        UpgradeableAsyncIsolationModeWrapperTrader _wrapper,
        IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo memory _depositInfo
    ) public {
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = _wrapper.VAULT_FACTORY().marketId();
        marketIdsPath[1] = _wrapper.DOLOMITE_MARGIN().getMarketIdByTokenAddress(_depositInfo.inputToken);

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(_wrapper.HANDLER_REGISTRY().getUnwrapperByToken(_wrapper.VAULT_FACTORY()));

        IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[] memory tradeTypes = new IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType[](1); // solhint-disable-line max-line-length
        tradeTypes[0] = IUpgradeableAsyncIsolationModeUnwrapperTrader.TradeType.FromDeposit;
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = _depositInfo.key;
        traderParams[0].tradeData = abi.encode(tradeTypes, keys);

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: AccountBalanceLib.BalanceCheckFlag.None
        });

        uint256 outputAmount = _depositInfo.inputAmount;
        IERC20(_depositInfo.inputToken).safeApprove(traderParams[0].trader, outputAmount);

        UpgradeableAsyncIsolationModeUnwrapperTrader(payable(traderParams[0].trader)).handleCallbackFromWrapperBefore();
        IIsolationModeTokenVaultV1(_depositInfo.vault).swapExactInputForOutput(
            _depositInfo.accountNumber,
            marketIdsPath,
            /* _inputAmountWei = */ _depositInfo.outputAmount,
            outputAmount,
            traderParams,
            /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
            userConfig
        );
        UpgradeableAsyncIsolationModeUnwrapperTrader(payable(traderParams[0].trader)).handleCallbackFromWrapperAfter();
    }
}
