// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { InternalAutoTraderBase } from "../traders/InternalAutoTraderBase.sol";
import { IInternalAutoTraderBase } from "../interfaces/traders/IInternalAutoTraderBase.sol";
import { ISmartDebtAutoTrader } from "./interfaces/ISmartDebtAutoTrader.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomitePriceOracle } from "../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IChainlinkPostPrices } from "./interfaces/IChainlinkPostPrices.sol";
import { ChainlinkDataStreamsTrader } from "./ChainlinkDataStreamsTrader.sol";
import { SmartDebtPairSettings } from "./SmartDebtPairSettings.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";


/**
 * @title   SmartDebtAutoTrader
 * @author  Dolomite
 *
 * Contract for performing internal trades using smart debt
 */
contract SmartDebtAutoTrader is OnlyDolomiteMargin, SmartDebtPairSettings, ChainlinkDataStreamsTrader, ISmartDebtAutoTrader {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SafeCast for int256;
    using DecimalLib for uint256;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "SmartDebtAutoTrader";
    bytes32 private constant _SMART_PAIRS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.smartPairsStorage")) - 1); // solhint-disable-line max-line-length
    uint256 private constant _36_DECIMALS_FACTOR = 10 ** 36;

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor(
        address _link,
        address _verifierProxy,
        address[] memory _tokens,
        bytes32[] memory _feedIds,
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) ChainlinkDataStreamsTrader(_link, _verifierProxy, _tokens, _feedIds, _chainId, _dolomiteRegistry)
    OnlyDolomiteMargin(_dolomiteMargin)
    {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    ) public override onlyDolomiteMargin(msg.sender) {
        (bytes[] memory reports, bool tradeEnabled) = abi.decode(_data, (bytes[], bool));
        super.callFunction(_sender, _accountInfo, abi.encode(tradeEnabled));

        _postPrices(reports);
    }

    // maker account is the zap account of the person making the trade
    // taker account is the user who has smart debt enabled
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo memory /* _makerAccount */,
        IDolomiteStructs.AccountInfo memory _takerAccount,
        IDolomiteStructs.Par memory /* oldInputPar */,
        IDolomiteStructs.Par memory /* newInputPar */,
        IDolomiteStructs.Wei memory _inputDeltaWei,
        bytes memory _data
    ) external override(IDolomiteAutoTrader, InternalAutoTraderBase) returns (IDolomiteStructs.AssetAmount memory) {
        Require.that(
            tradeEnabled(),
            _FILE,
            "Trade is not enabled"
        );

        PairPosition memory pairPosition = userToPair(_takerAccount.owner, _takerAccount.number);
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_inputMarketId, _outputMarketId);
        Require.that(
            pairPosition.pairType != PairType.NONE && pairPosition.pairBytes == pairBytes,
            _FILE,
            "User does not have the pair set"
        );

        (uint256 adjInputAmount, uint256 outputTokenAmount) = _calculateInputAndOutputTokenAmount(
            _inputMarketId,
            _outputMarketId,
            pairPosition,
            _inputDeltaWei.value,
            _data
        );
        _validateExchangeRate(
            pairPosition,
            _inputMarketId,
            _outputMarketId,
            adjInputAmount,
            outputTokenAmount
        );

        uint256 inputMarketId = _inputMarketId;
        uint256 outputMarketId = _outputMarketId;
        if (pairPosition.pairType == PairType.SMART_COLLATERAL) {
            // if smart collateral, confirm taker has more collateral than output token amount
            IDolomiteStructs.Wei memory takerAccountWei = DOLOMITE_MARGIN().getAccountWei(
                _takerAccount,
                outputMarketId
            );
            Require.that(
                isSmartCollateralPair(inputMarketId, outputMarketId),
                _FILE,
                "Collateral pair is not active"
            );
            Require.that(
                takerAccountWei.sign && takerAccountWei.value >= outputTokenAmount,
                _FILE,
                "Insufficient collateral"
            );
        } else {
            // if smart debt confirm taker has more debt than input token amount
            IDolomiteStructs.Wei memory takerAccountWei = DOLOMITE_MARGIN().getAccountWei(
                _takerAccount,
                inputMarketId
            );
            Require.that(
                isSmartDebtPair(inputMarketId, outputMarketId),
                _FILE,
                "Debt pair is not active"
            );
            Require.that(
                !takerAccountWei.sign && takerAccountWei.value >= adjInputAmount,
                _FILE,
                "Insufficient debt"
            );
        }

        return IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: outputTokenAmount
        });
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) 
    external
    view
    override(IInternalAutoTraderBase, InternalAutoTraderBase) returns (IDolomiteStructs.ActionArgs[] memory) {
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            actionsLength(_params.trades)
        );
        uint256 actionCursor;

        (
            IDolomiteStructs.Decimal memory adminFeePercentage,
            IDolomiteStructs.Decimal memory feePercentage
        ) = _getFees(_params.inputMarketId, _params.outputMarketId);

        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            /* accountId = */ 0,
            address(this),
            // @follow-up Check how I'm doing this. Maybe just do abi.encode(_params.extraData, true)
            abi.encode(abi.decode(_params.extraData, (bytes[])), true)
        );
        actions[actionCursor++] = AccountActionLib.encodeTransferAction(
            _params.takerAccountId,
            _params.feeAccountId,
            _params.inputMarketId,
            IDolomiteStructs.AssetDenomination.Wei,
            _params.inputAmountWei.mul(adminFeePercentage).mul(feePercentage)
        );
        // @audit check rounding errors

        uint256 tradeTotal;
        for (uint256 i; i < _params.trades.length; i++) {
            uint256 originalAmountInWei = _params.trades[i].amount;
            uint256 minOutputAmount = _params.trades[i].minOutputAmount;
            tradeTotal += originalAmountInWei;

            uint256 adminFeeAmount = originalAmountInWei.mul(adminFeePercentage).mul(feePercentage);
            // @dev This account action lib function will flip the taker and maker accounts
            actions[actionCursor++] = AccountActionLib.encodeInternalTradeActionWithWhitelistedTrader(
                /* takerAccountId = */ _params.takerAccountId,
                /* makerAccountId = */ _params.trades[i].makerAccountId,
                /* primaryMarketId = */ _params.inputMarketId,
                /* secondaryMarketId = */ _params.outputMarketId,
                /* traderAddress = */ address(this),
                /* amountInWei = */ originalAmountInWei - adminFeeAmount,
                /* chainId = */ CHAIN_ID,
                /* calculateAmountWithMakerAccount = */ true, // @todo Add tests on non-arbitrum chain
                /* orderData = */ abi.encode(minOutputAmount, adminFeeAmount)
            );
        }

        bytes[] memory emptyReports = new bytes[](0);
        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            0,
            address(this),
            abi.encode(emptyReports, false)
        );

        // @audit Make sure this isn't thrown off with rounding
        Require.that(
            tradeTotal == _params.inputAmountWei,
            _FILE,
            "Invalid swap amounts sum"
        );

        return actions;
    }

    function actionsLength(
        InternalTradeParams[] memory _trades
    ) public pure override(IInternalAutoTraderBase, InternalAutoTraderBase) returns (uint256) {
        return _trades.length + 3;
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _calculateInputAndOutputTokenAmount(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        PairPosition memory _pairPosition,
        uint256 _inputAmountWei,
        bytes memory _data
    ) internal view returns (uint256, uint256) {
        (uint256 minOutputAmount, uint256 adminFeeAmount) = abi.decode(_data, (uint256, uint256));
        (, IDolomiteStructs.Decimal memory feePercentage) = _getFees(_pairPosition.pairBytes);
        uint256 adjInputAmount = (_inputAmountWei + adminFeeAmount).mul(DecimalLib.oneSub(feePercentage));

        IDolomitePriceOracle chainlinkDataStreamsPriceOracle = DOLOMITE_REGISTRY.chainlinkDataStreamsPriceOracle();
        address inputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarketId);
        address outputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId);

        uint256 inputPrice = chainlinkDataStreamsPriceOracle.getPrice(inputToken).value;
        uint256 outputPrice = chainlinkDataStreamsPriceOracle.getPrice(outputToken).value;
        assert(inputPrice != 0 && outputPrice != 0);

        uint256 adjInputValue = adjInputAmount * inputPrice;
        uint256 outputAmount = adjInputValue / outputPrice;

        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output token amount"
        );

        return (adjInputAmount, outputAmount);
    }

    function _validateExchangeRate(
        PairPosition memory _pairPosition,
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        uint256 _inputAmountWei,
        uint256 _outputAmount
    ) internal view {
        address inputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarketId);
        address outputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId);
        uint256 inputDecimals = IERC20Metadata(inputToken).decimals();
        uint256 outputDecimals = IERC20Metadata(outputToken).decimals();

        uint256 inputAmountStandardized = _standardizeAmount(_inputAmountWei, inputDecimals);
        uint256 outputAmountStandardized = _standardizeAmount(_outputAmount, outputDecimals);
        
        uint256 exchangeRate;
        if (_inputMarketId < _outputMarketId) {
            exchangeRate = inputAmountStandardized.div(outputAmountStandardized.toDecimal());
        } else {
            exchangeRate = outputAmountStandardized.div(inputAmountStandardized.toDecimal());
        }

        Require.that(
            exchangeRate >= _pairPosition.minExchangeRate,
            _FILE,
            "Invalid exchange rate"
        );
        if (_pairPosition.maxExchangeRate != 0) {
            Require.that(
                exchangeRate <= _pairPosition.maxExchangeRate,
                _FILE,
                "Invalid exchange rate"
            );
        }
    }

    function _standardizeAmount(
        uint256 _amount,
        uint256 _decimals
    ) internal pure returns (uint256) {
        uint256 tokenDecimalsFactor = 10 ** _decimals;
        uint256 changeFactor = _36_DECIMALS_FACTOR / tokenDecimalsFactor;
        return _amount * changeFactor;
    }

    function _getFees(
        uint256 _inputMarketId,
        uint256 _outputMarketId
    ) internal view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        (uint256 adminFee, uint256 globalFee) = super._getFees();
        uint256 pairFeeOverride = pairFee(_inputMarketId, _outputMarketId);

        return (adminFee.toDecimal(), pairFeeOverride == 0 ? globalFee.toDecimal() : pairFeeOverride.toDecimal());
    }

    function _getFees(
        bytes32 _pairBytes
    ) internal view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();

        (uint256 adminFee, uint256 globalFee) = super._getFees();
        uint256 pairFeeOverride = smartPairsStorage.pairToFee[_pairBytes];

        return (adminFee.toDecimal(), pairFeeOverride == 0 ? globalFee.toDecimal() : pairFeeOverride.toDecimal());
    }
}
