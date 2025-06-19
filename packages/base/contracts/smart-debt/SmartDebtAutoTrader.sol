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

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ChainlinkDataStreamsTrader } from "./ChainlinkDataStreamsTrader.sol";
import { InternalAutoTraderBase } from "./InternalAutoTraderBase.sol";
import { SmartDebtSettings } from "./SmartDebtSettings.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IInternalAutoTraderBase } from "./interfaces/IInternalAutoTraderBase.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { ISmartDebtAutoTrader } from "./interfaces/ISmartDebtAutoTrader.sol";


/**
 * @title   SmartDebtAutoTrader
 * @author  Dolomite
 *
 * Contract for performing internal trades using smart debt
 */
contract SmartDebtAutoTrader is
    OnlyDolomiteMargin,
    SmartDebtSettings,
    ChainlinkDataStreamsTrader,
    ISmartDebtAutoTrader
{
    using DecimalLib for uint256;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "SmartDebtAutoTrader";
    uint256 private constant _ONE = 1 ether;

    // ========================================================
    // ===================== Modifiers ========================
    // ========================================================

    modifier onlyTradeEnabled() {
        Require.that(
            tradeEnabled(),
            _FILE,
            "Trade is not enabled"
        );
        _;
    }

    // ========================================================
    // ===================== Constructor ======================
    // ========================================================

    constructor(
        address _link,
        address _verifierProxy,
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    )
        ChainlinkDataStreamsTrader(_link, _verifierProxy, _chainId, _dolomiteRegistry)
        OnlyDolomiteMargin(_dolomiteMargin)
    {}

    function initialize(
        address[] memory _tokens,
        bytes32[] memory _feedIds
    ) public initializer {
        _ChainlinkDataStreamsTrader__initialize(_tokens, _feedIds);
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

        if (reports.length > 0) {
            _postPrices(reports);
        }
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
    ) external override(IDolomiteAutoTrader, InternalAutoTraderBase) onlyTradeEnabled returns (IDolomiteStructs.AssetAmount memory) {
        PairPosition storage pairPosition = _userToPair(_takerAccount.owner, _takerAccount.number);
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_inputMarketId, _outputMarketId);
        Require.that(
            pairPosition.pairType != PairType.NONE && pairPosition.pairBytes == pairBytes,
            _FILE,
            "User does not have the pair set"
        );

        uint256 outputTokenAmount = _calculateOutputTokenAmount(
            _inputMarketId,
            _outputMarketId,
            pairPosition,
            _inputDeltaWei.value,
            _data
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
                !takerAccountWei.sign && takerAccountWei.value >= _inputDeltaWei.value,
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
    override(IInternalAutoTraderBase, InternalAutoTraderBase)
    returns (IDolomiteStructs.ActionArgs[] memory) {
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            actionsLength(_params.trades)
        );
        uint256 actionCursor;

        // Call function to set tradeEnabled to true and post prices
        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            /* accountId = */ 0,
            address(this),
            abi.encode(abi.decode(_params.extraData, (bytes[])), true) // @follow-up check this encoding
        );

        (
            IDolomiteStructs.Decimal memory adminFeePercentage,
            IDolomiteStructs.Decimal memory feePercentage
        ) = _getFees(_params.inputMarketId, _params.outputMarketId);

        uint256 tradeTotal;
        uint256 adminTotal;
        for (uint256 i; i < _params.trades.length; i++) {
            uint256 amountInWei = _params.trades[i].amount;
            uint256 minOutputAmount = _params.trades[i].minOutputAmount;
            uint256 adminFeeAmount = amountInWei.mul(adminFeePercentage).mul(feePercentage);

            // @dev This account action lib function will flip the taker and maker accounts
            actions[actionCursor++] = AccountActionLib.encodeInternalTradeActionWithWhitelistedTrader(
                /* takerAccountId = */ _params.takerAccountId,
                /* makerAccountId = */ _params.trades[i].makerAccountId,
                /* primaryMarketId = */ _params.inputMarketId,
                /* secondaryMarketId = */ _params.outputMarketId,
                /* traderAddress = */ address(this),
                /* amountInWei = */ amountInWei - adminFeeAmount,
                /* chainId = */ CHAIN_ID,
                /* calculateAmountWithMakerAccount = */ true, // @todo Add tests on non-arbitrum chain
                /* orderData = */ abi.encode(minOutputAmount, adminFeeAmount)
            );

            tradeTotal += amountInWei;
            adminTotal += adminFeeAmount;
        }
        Require.that(
            tradeTotal == _params.inputAmountWei,
            _FILE,
            "Invalid swap amounts sum"
        );

        // Transfer admin fees to fee account
        actions[actionCursor++] = AccountActionLib.encodeTransferAction(
            _params.takerAccountId,
            _params.feeAccountId,
            _params.inputMarketId,
            IDolomiteStructs.AssetDenomination.Wei,
            adminTotal
        );

        // Call function to set tradeEnabled to false
        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            0,
            address(this),
            abi.encode(new bytes(0), false)
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

    function _calculateOutputTokenAmount(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        PairPosition storage _pairPosition,
        uint256 _inputAmountWei,
        bytes memory _data
    ) internal view virtual returns (uint256) {
        address inputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarketId);
        address outputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId);

        uint256 bidPrice = getLatestReport(inputToken).bid;
        uint256 askPrice = getLatestReport(outputToken).ask;

        _validateExchangeRate(_inputMarketId, _outputMarketId, bidPrice, askPrice, _pairPosition);

        // Standardize prices to have 36 - token decimals prices
        bidPrice = _standardizeNumberOfDecimals(
            IERC20Metadata(inputToken).decimals(),
            bidPrice,
            _DATA_STREAM_PRICE_DECIMALS
        );
        askPrice = _standardizeNumberOfDecimals(
            IERC20Metadata(outputToken).decimals(),
            askPrice,
            _DATA_STREAM_PRICE_DECIMALS
        );
        assert(bidPrice != 0 && askPrice != 0);

        IDolomiteStructs.Decimal memory dynamicFee = _calculateDynamicFee(_inputAmountWei, _pairPosition);
        
        // @dev We add the admin fee back because admin gets a % of the base fee
        (uint256 minOutputAmount, uint256 adminFeeAmount) = abi.decode(_data, (uint256, uint256));
        uint256 adjInputAmount = (_inputAmountWei + adminFeeAmount).mul(DecimalLib.oneSub(dynamicFee));

        uint256 outputAmount = adjInputAmount * bidPrice / askPrice;
        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output token amount"
        );

        return outputAmount;
    }

    function getVolatilityLevel(
        LatestReport memory _report
    ) public view returns (VolatilityLevel) {
        
        // Calculate bid/ask percentage spread
        uint256 bidAskSpread = _report.ask - _report.bid;
        uint256 benchmarkPrice = _report.benchmarkPrice;

        uint256 spreadPercentage = bidAskSpread * 1 ether / benchmarkPrice;

        if (spreadPercentage > .005 ether) {
            return VolatilityLevel.ARMAGEDDON;
        } else if (spreadPercentage > .001 ether) {
            return VolatilityLevel.SLIGHT;
        } else {
            return VolatilityLevel.NORMAL;
        }
    }

    function _calculateDynamicFee(
        uint256 _inputAmountWei,
        PairPosition memory _pairPosition
    ) internal view returns (IDolomiteStructs.Decimal memory) {
        // @todo adjust to use time since report
        // @todo exponential curve for fee depending on time since report. Double the fee over some time period maybe fail after 2 minutes
        // @todo at 1 minute double, then every 30 seconds thereafter judging off user's observation timestamp
        (, IDolomiteStructs.Decimal memory feePercentage) = _getFees(_pairPosition.pairBytes);
        return feePercentage;
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

    function _validateExchangeRate(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        uint256 _bidPrice,
        uint256 _askPrice,
        PairPosition memory _pairPosition
    ) internal pure {
        uint256 exchangeRate;
        if (_inputMarketId < _outputMarketId) {
            exchangeRate = _bidPrice * _ONE / _askPrice;
        } else {
            exchangeRate = _askPrice * _ONE / _bidPrice;
        }

        if (_pairPosition.minExchangeRate != 0) {
            Require.that(
                exchangeRate >= _pairPosition.minExchangeRate,
                _FILE,
                "Exchange rate is out of range"
            );
        }

        if (_pairPosition.maxExchangeRate != 0) {
            Require.that(
                exchangeRate <= _pairPosition.maxExchangeRate,
                _FILE,
                "Exchange rate is out of range"
            );
        }
    }
}
