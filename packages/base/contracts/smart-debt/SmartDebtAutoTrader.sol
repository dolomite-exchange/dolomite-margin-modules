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
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IInternalAutoTraderBase } from "./interfaces/IInternalAutoTraderBase.sol";
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
    using DecimalLib for IDolomiteStructs.Decimal;

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

    /// @inheritdoc ISmartDebtAutoTrader
    function initialize(
        address[] memory _tokens,
        bytes32[] memory _feedIds
    ) public initializer {
        _ChainlinkDataStreamsTrader__initialize(_tokens, _feedIds);
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    /**
     * Callback function for DolomiteMargin call action. Sets tradeEnabled to true or false
     * and verifies the Chainlink data stream reports
     * 
     * @dev Only callable by a trusted internal trader caller
     * 
     * @param  _sender      The address of the sender
     * @param  _accountInfo The account info
     * @param  _data        The encoded data
     */
    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    ) public override(IInternalAutoTraderBase, InternalAutoTraderBase) onlyDolomiteMargin(msg.sender) {
        (bytes[] memory reports, bool tradeEnabled) = abi.decode(_data, (bytes[], bool));
        super.callFunction(_sender, _accountInfo, abi.encode(tradeEnabled));

        if (reports.length > 0) {
            _postPrices(reports);
        }
    }

    /**
     * Gets the trade cost for an internal trade. Called within a DolomiteMargin trade action
     * 
     * @dev The maker account is zap account of user making the trade, taker account is smart debt user
     * 
     * @param  _inputMarketId   The input market ID
     * @param  _outputMarketId  The output market ID
     * @param  _takerAccount    The taker account
     * @param  _inputDeltaWei   The input delta wei
     * @param  _data            The encoded data
     */
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo memory /* _makerAccount */,
        IDolomiteStructs.AccountInfo memory _takerAccount,
        IDolomiteStructs.Par memory /* oldInputPar */,
        IDolomiteStructs.Par memory /* newInputPar */,
        IDolomiteStructs.Wei memory _inputDeltaWei,
        bytes memory _data
    )
    external
    override(IInternalAutoTraderBase, InternalAutoTraderBase)
    onlyTradeEnabled
    returns (IDolomiteStructs.AssetAmount memory) {
        PairPosition memory pairPosition = userToPair(_takerAccount.owner, _takerAccount.number);
        bytes32 pairBytes = _getPairBytes(_inputMarketId, _outputMarketId);
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

    /// @inheritdoc IInternalAutoTraderBase
    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) 
    external
    view
    override(IInternalAutoTraderBase, InternalAutoTraderBase)
    returns (IDolomiteStructs.ActionArgs[] memory) {
        uint256 actionCursor;
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            actionsLength(_params.trades)
        );

        // Call function to set tradeEnabled to true and post prices
        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            /* accountId = */ 0,
            address(this),
            abi.encode(abi.decode(_params.extraData, (bytes[])), true) // @follow-up check this encoding
        );

        (
            IDolomiteStructs.Decimal memory adminFeePercentage,
            IDolomiteStructs.Decimal memory feePercentage
        ) = pairFees(_getPairBytes(_params.inputMarketId, _params.outputMarketId));

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

        // Call function to set tradeEnabled to false
        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            0,
            address(this),
            abi.encode(new bytes(0), false)
        );

        // Transfer admin fees to fee account
        actions[actionCursor++] = AccountActionLib.encodeTransferAction(
            _params.takerAccountId,
            _params.feeAccountId,
            _params.inputMarketId,
            IDolomiteStructs.AssetDenomination.Wei,
            adminTotal
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

    /**
     * Calculates the output token amount for a trade
     * 
     * @dev outputAmount = fullInputAmount * (1 - dynamicFeePercentage) * inputTokenBidPrice / outputTokenAskPrice
     * @dev Recall that we subtract the admin fee from input amount during createActions, therefore, we must add it back
     *      to appropriately calculate the fee. fullInputAmount = inputAmount + adminFeeAmount
     * @dev We standardize the prices to have 36 - tokenDecimals so we can do simple math to calculate output amount
     *      usdcAmount (6 decimals) * bidPriceOfUsdc (36 - 6 = 30 decimals) = usdcValue (36 decimals)
     *      usdcValue (36 decimals) / askPriceOfUsdt (36 - 6 = 30 decimals) = usdt amount in 6 decimals
     * 
     * @param  _inputMarketId   The input market ID
     * @param  _outputMarketId  The output market ID
     * @param  _pairPosition    The pair position
     * @param  _inputAmountWei  The input amount in wei
     * @param  _data            The encoded data
     * 
     * @return The output token amount
     */
    function _calculateOutputTokenAmount(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        PairPosition memory _pairPosition,
        uint256 _inputAmountWei,
        bytes memory _data
    ) internal view virtual returns (uint256) {
        address inputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarketId);
        address outputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId);

        LatestReport memory inputReport = getLatestReport(inputToken);
        LatestReport memory outputReport = getLatestReport(outputToken);

        _validateExchangeRate(_inputMarketId, _outputMarketId, inputReport.bid, outputReport.ask, _pairPosition);

        // Standardize prices to have 36 - token decimals prices
        uint256 bidPrice = _standardizeNumberOfDecimals(
            IERC20Metadata(inputToken).decimals(),
            inputReport.bid,
            _DATA_STREAM_PRICE_DECIMALS
        );
        uint256 askPrice = _standardizeNumberOfDecimals(
            IERC20Metadata(outputToken).decimals(),
            outputReport.ask,
            _DATA_STREAM_PRICE_DECIMALS
        );
        assert(bidPrice != 0 && askPrice != 0);

        IDolomiteStructs.Decimal memory totalFeePercentage = _calculateTotalFeePercentage(
            inputReport,
            outputReport,
            _pairPosition
        );
        
        (uint256 minOutputAmount, uint256 adminFeeAmount) = abi.decode(_data, (uint256, uint256));
        uint256 adjInputAmount = (_inputAmountWei + adminFeeAmount).mul(DecimalLib.oneSub(totalFeePercentage));

        uint256 outputAmount = adjInputAmount * bidPrice / askPrice;
        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output token amount"
        );

        return outputAmount;
    }

    /**
     * Calculates the total fee percentage for a pair based on the base fee, volatility level, and time since report
     * 
     * @dev The formula is:
     *      totalFeePercentage = baseFeePercentage * (1 + volatilityFeePercentage) * timeMultiplier
     * 
     * @param  _inputReport     The input report
     * @param  _outputReport    The output report
     * @param  _pairPosition    The pair position
     * 
     * @return The dynamic fee
     */
    function _calculateTotalFeePercentage(
        LatestReport memory _inputReport,
        LatestReport memory _outputReport,
        PairPosition memory _pairPosition
    ) internal view returns (IDolomiteStructs.Decimal memory) {
        FeeSettings memory feeSettings = pairFeeSettings(_pairPosition.pairBytes);
        (,IDolomiteStructs.Decimal memory baseFee) = pairFees(_pairPosition.pairBytes);

        IDolomiteStructs.Decimal memory volatilityFeePercentage = _getVolatilityFeePercentage(
            _inputReport,
            _outputReport,
            feeSettings
        );
        uint256 timeMultiplier = _calculateTimeMultiplier(
            _min(_inputReport.timestamp, _outputReport.timestamp),
            feeSettings
        );

        return (timeMultiplier * baseFee.value.mul(volatilityFeePercentage.onePlus())).toDecimal();
    }

    /**
     * Gets the volatility-based fee percentage for a pair of reports
     * 
     * @dev Returns the corresponding fee percentage based on the maximum volatility level between both reports
     * 
     * @param  _inputReport     The latest report for the input token
     * @param  _outputReport    The latest report for the output token
     * @param  _feeSettings     The fee settings containing volatility thresholds
     * 
     * @return The volatility-based fee percentage as a Decimal
     */
    function _getVolatilityFeePercentage(
        LatestReport memory _inputReport,
        LatestReport memory _outputReport,
        FeeSettings memory _feeSettings
    ) internal view returns (IDolomiteStructs.Decimal memory) {
        VolatilityLevel inputVolatility = _getVolatilityLevel(_inputReport, _feeSettings);
        VolatilityLevel outputVolatility = _getVolatilityLevel(_outputReport, _feeSettings);

        if (inputVolatility == VolatilityLevel.DEPEG || outputVolatility == VolatilityLevel.DEPEG) {
            return depegFeePercentage();
        } else if (inputVolatility == VolatilityLevel.SLIGHT || outputVolatility == VolatilityLevel.SLIGHT) {
            return slightFeePercentage();
        } else {
            return IDolomiteStructs.Decimal({ value: 0 });
        }
    }

    /**
     * Calculates the time multiplier based on report age to penalize stale data
     * 
     * @dev Returns 1 if no time penalty applies (within cliff period or settings disabled)
     *      Starts at 2x multiplier after cliff period
     *      Increases by 1x for each compounding interval beyond the cliff
     * 
     * @param  _oldestReportTimestamp   The timestamp of the oldest report between input and output tokens
     * @param  _feeSettings             The fee settings containing cliff and compounding interval parameters
     * 
     * @return The time multiplier (1 if no penalty, >=2 if penalty applies)
     */
    function _calculateTimeMultiplier(
        uint256 _oldestReportTimestamp,
        FeeSettings memory _feeSettings
    ) internal view returns (uint256) {
        if (_feeSettings.feeCliffSeconds == 0 || _feeSettings.feeCompoundingInterval == 0) {
            return 1;
        }

        uint256 timeSinceOldestReport = block.timestamp - _oldestReportTimestamp;
        if (timeSinceOldestReport < _feeSettings.feeCliffSeconds) {
            return 1;
        } else {
            return 2 + (timeSinceOldestReport - _feeSettings.feeCliffSeconds) / _feeSettings.feeCompoundingInterval;
        }
    }

    /**
     * Gets the volatility level for a pair based on the bid/ask spread
     * 
     * @param  _report The latest report
     * 
     * @return The volatility level
     */
    function _getVolatilityLevel(
        LatestReport memory _report,
        FeeSettings memory _feeSettings
    ) internal pure returns (VolatilityLevel) {
        if (_feeSettings.depegThreshold.value == 0 || _feeSettings.slightThreshold.value == 0) {
            return VolatilityLevel.NORMAL;
        }

        uint256 spreadPercentage = (_report.ask - _report.bid) * _ONE / _report.benchmarkPrice;
        if (spreadPercentage >= _feeSettings.depegThreshold.value) {
            return VolatilityLevel.DEPEG;
        } else if (spreadPercentage >= _feeSettings.slightThreshold.value) {
            return VolatilityLevel.SLIGHT;
        } else {
            return VolatilityLevel.NORMAL;
        }
    }

    /**
     * Validates that the exchange rate being used is within the smart debt user's valid range
     * 
     * @dev These prices are straight from the data stream and have 18 decimals
     * 
     * @param  _inputMarketId   The input market ID
     * @param  _outputMarketId  The output market ID
     * @param  _bidPrice        The bid price
     * @param  _askPrice        The ask price
     * @param  _pairPosition    The smart debt user's pair position
     */
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

    /**
     * Returns the minimum of two uint256 values
     * 
     * @param  _a The first value
     * @param  _b The second value
     * 
     * @return The minimum value
     */
    function _min(uint256 _a, uint256 _b) internal pure returns (uint256) {
        return _a < _b ? _a : _b;
    }
}
