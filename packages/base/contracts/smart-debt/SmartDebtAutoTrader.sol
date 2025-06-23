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
     * @param _sender The address of the sender
     * @param _accountInfo The account info
     * @param _data The encoded data
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
     * @param _inputMarketId The input market ID
     * @param _outputMarketId The output market ID
     * @param _takerAccount The taker account
     * @param _inputDeltaWei The input delta wei
     * @param _data The encoded data
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

    /**
     * Calculates the output token amount for a trade
     * 
     * @param _inputMarketId The input market ID
     * @param _outputMarketId The output market ID
     * @param _pairPosition The pair position
     * @param _inputAmountWei The input amount in wei
     * @param _data The encoded data
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

        IDolomiteStructs.Decimal memory dynamicFee = _calculateDynamicFee(inputReport, outputReport, _pairPosition);
        
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

    /**
     * Gets the volatility level for a pair based on the bid/ask spread
     * 
     * @param _report The latest report
     * 
     * @return The volatility level
     */
    function getVolatilityLevel(
        LatestReport memory _report,
        FeeSettings memory _feeSettings
    ) public pure returns (VolatilityLevel) {
        uint256 spreadPercentage = (_report.ask - _report.bid) * _ONE / _report.benchmarkPrice;

        if (spreadPercentage > _feeSettings.depegThreshold.value) {
            return VolatilityLevel.DEPEG;
        } else if (spreadPercentage > _feeSettings.slightThreshold.value) {
            return VolatilityLevel.SLIGHT;
        } else {
            return VolatilityLevel.NORMAL;
        }
    }

    /**
     * Calculates the dynamic fee for a pair based on the volatility level and time since report
     * 
     * @dev The volatility level is determined by the bid/ask spread
     * @dev The fee increases exponentially as time since report increases
     * 
     * @param _inputReport The input report
     * @param _outputReport The output report
     * @param _pairPosition The pair position
     * 
     * @return The dynamic fee
     */
    function _calculateDynamicFee(
        LatestReport memory _inputReport,
        LatestReport memory _outputReport,
        PairPosition memory _pairPosition
    ) internal view returns (IDolomiteStructs.Decimal memory) {
        FeeSettings memory feeSettings = pairFeeSettings(_pairPosition.pairBytes);
        (,IDolomiteStructs.Decimal memory baseFee) = pairFees(_pairPosition.pairBytes);

        VolatilityLevel inputVolatility = getVolatilityLevel(_inputReport, feeSettings);
        VolatilityLevel outputVolatility = getVolatilityLevel(_outputReport, feeSettings);

        IDolomiteStructs.Decimal memory dynamicFeePercentage;
        if (inputVolatility == VolatilityLevel.DEPEG || outputVolatility == VolatilityLevel.DEPEG) {
            dynamicFeePercentage = depegFeePercentage();
        } else if (inputVolatility == VolatilityLevel.SLIGHT || outputVolatility == VolatilityLevel.SLIGHT) {
            dynamicFeePercentage = slightFeePercentage();
        } else {
            dynamicFeePercentage = IDolomiteStructs.Decimal({ value: 0 });
        }

        // Calculate the time multiplier
        uint256 timeSinceOldestReport = _inputReport.timestamp < _outputReport.timestamp
                                            ? block.timestamp - _inputReport.timestamp
                                            : block.timestamp - _outputReport.timestamp;
        if (timeSinceOldestReport > feeSettings.feeCliffSeconds) {
            uint256 multiplier = 2 + (timeSinceOldestReport - feeSettings.feeCliffSeconds) / feeSettings.feeCompoundingInterval; // solhint-disable-line max-line-length
            dynamicFeePercentage = dynamicFeePercentage.mul(multiplier.toDecimal());
        }

        return baseFee.mul(dynamicFeePercentage.onePlus());
    }

    /**
     * Validates that the exchange rate being used is within the smart debt user's valid range
     * 
     * @dev These prices are straight from the data stream and have 18 decimals
     * 
     * @param _inputMarketId The input market ID
     * @param _outputMarketId The output market ID
     * @param _bidPrice The bid price
     * @param _askPrice The ask price
     * @param _pairPosition The smart debt user's pair position
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
}
