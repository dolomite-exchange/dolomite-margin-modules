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

import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol"; // solhint-disable-line max-line-length


library AsyncIsolationModeTraderLib {

    function swapExactInputForOutputForWithdrawal(
        IUpgradeableAsyncIsolationModeUnwrapperTrader _unwrapper,
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

        IGmxV2IsolationModeTokenVaultV1(_withdrawalInfo.vault).swapExactInputForOutput(
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
        IGmxV2IsolationModeWrapperTraderV2 _wrapper,
        IGmxV2IsolationModeWrapperTraderV2.DepositInfo memory _depositInfo
    ) public {
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = _wrapper.VAULT_FACTORY().marketId();
        marketIdsPath[1] = _wrapper.DOLOMITE_MARGIN().getMarketIdByTokenAddress(_depositInfo.inputToken);

        IGenericTraderBase.TraderParam[] memory traderParams = new IGenericTraderBase.TraderParam[](1);
        traderParams[0].traderType = IGenericTraderBase.TraderType.IsolationModeUnwrapper;
        traderParams[0].makerAccountIndex = 0;
        traderParams[0].trader = address(_wrapper.GMX_REGISTRY_V2().gmxV2UnwrapperTrader());

        IGmxV2IsolationModeUnwrapperTraderV2.TradeType[] memory tradeTypes = new IGmxV2IsolationModeUnwrapperTraderV2.TradeType[](1); // solhint-disable-line max-line-length
        tradeTypes[0] = IGmxV2IsolationModeUnwrapperTraderV2.TradeType.FromDeposit;
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = _depositInfo.key;
        traderParams[0].tradeData = abi.encode(tradeTypes, keys);

        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: AccountBalanceLib.BalanceCheckFlag.None
        });

        uint256 outputAmount = _depositInfo.inputAmount;
        IERC20(_depositInfo.inputToken).safeApprove(traderParams[0].trader, outputAmount);

        IGmxV2IsolationModeUnwrapperTraderV2(traderParams[0].trader).handleGmxCallbackFromWrapperBefore();
        IGmxV2IsolationModeTokenVaultV1(_depositInfo.vault).swapExactInputForOutput(
            _depositInfo.accountNumber,
            marketIdsPath,
            /* _inputAmountWei = */ _depositInfo.outputAmount,
            outputAmount,
            traderParams,
            /* _makerAccounts = */ new IDolomiteMargin.AccountInfo[](0),
            userConfig
        );
        IGmxV2IsolationModeUnwrapperTraderV2(traderParams[0].trader).handleGmxCallbackFromWrapperAfter();
    }
}
