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

import { GmxDeposit } from "./GmxDeposit.sol";
import { GmxMarket } from "./GmxMarket.sol";
import { GmxMarketPoolValueInfo } from "./GmxMarketPoolValueInfo.sol";
import { GmxPrice } from "./GmxPrice.sol";
import { GmxWithdrawal } from "./GmxWithdrawal.sol";
import { IGmxDataStore } from "./IGmxDataStore.sol";


/**
 * @title   IGmxReader
 * @author  Dolomite
 *
 * @notice  GMX Reader Interface
 */
interface IGmxReader {

    // ================ Errors ================

    // AdlHandler errors
    error AdlNotRequired(int256 pnlToPoolFactor, uint256 maxPnlFactorForAdl);
    error InvalidAdl(int256 nextPnlToPoolFactor, int256 pnlToPoolFactor);
    error PnlOvercorrected(int256 nextPnlToPoolFactor, uint256 minPnlFactorForAdl);

    // AdlUtils errors
    error InvalidSizeDeltaForAdl(uint256 sizeDeltaUsd, uint256 positionSizeInUsd);
    error AdlNotEnabled();

    // Bank errors
    error SelfTransferNotSupported(address receiver);
    error InvalidNativeTokenSender(address msgSender);

    // BaseRouter
    error CouldNotSendNativeToken(address receiver, uint256 amount);

    // CallbackUtils errors
    error MaxCallbackGasLimitExceeded(uint256 callbackGasLimit, uint256 maxCallbackGasLimit);

    // Config errors
    error InvalidBaseKey(bytes32 baseKey);
    error InvalidFeeFactor(bytes32 baseKey, uint256 value);

    // Timelock errors
    error ActionAlreadySignalled();
    error ActionNotSignalled();
    error SignalTimeNotYetPassed(uint256 signalTime);
    error InvalidTimelockDelay(uint256 timelockDelay);
    error MaxTimelockDelayExceeded(uint256 timelockDelay);
    error InvalidFeeReceiver(address receiver);
    error InvalidOracleSigner(address receiver);

    // DepositStoreUtils errors
    error DepositNotFound(bytes32 key);

    // DepositUtils errors
    error EmptyDeposit();
    error EmptyDepositAmounts();

    // ExecuteDepositUtils errors
    error MinMarketTokens(uint256 received, uint256 expected);
    error EmptyDepositAmountsAfterSwap();
    error InvalidPoolValueForDeposit(int256 poolValue);
    error InvalidSwapOutputToken(address outputToken, address expectedOutputToken);
    error InvalidReceiverForFirstDeposit(address receiver, address expectedReceiver);
    error InvalidMinMarketTokensForFirstDeposit(uint256 minMarketTokens, uint256 expectedMinMarketTokens);

    // ExchangeUtils errors
    error RequestNotYetCancellable(uint256 requestAge, uint256 requestExpirationAge, string requestType);

    // GlpMigrator errors
    error InvalidGlpAmount(uint256 totalGlpAmountToRedeem, uint256 totalGlpAmount);
    error InvalidLongTokenForMigration(address market, address migrationLongToken, address marketLongToken);
    error InvalidShortTokenForMigration(address market, address migrationShortToken, address marketShortToken);

    // OrderHandler errors
    error OrderNotUpdatable(uint256 orderType);
    error InvalidKeeperForFrozenOrder(address keeper);

    // FeatureUtils errors
    error DisabledFeature(bytes32 key);

    // FeeHandler errors
    error InvalidClaimFeesInput(uint256 marketsLength, uint256 tokensLength);

    // GasUtils errors
    error InsufficientExecutionFee(uint256 minExecutionFee, uint256 executionFee);
    error InsufficientWntAmountForExecutionFee(uint256 wntAmount, uint256 executionFee);
    error InsufficientExecutionGasForErrorHandling(uint256 startingGas, uint256 minHandleErrorGas);
    error InsufficientExecutionGas(
        uint256 startingGas,
        uint256 estimatedGasLimit,
        uint256 minAdditionalGasForExecution
    );
    error InsufficientHandleExecutionErrorGas(uint256 gas, uint256 minHandleExecutionErrorGas);

    // MarketFactory errors
    error MarketAlreadyExists(bytes32 salt, address existingMarketAddress);

    // MarketStoreUtils errors
    error MarketNotFound(address key);

    // MarketUtils errors
    error EmptyMarket();
    error DisabledMarket(address market);
    error MaxSwapPathLengthExceeded(uint256 swapPathLengh, uint256 maxSwapPathLength);
    error InsufficientPoolAmount(uint256 poolAmount, uint256 amount);
    error InsufficientReserve(uint256 reservedUsd, uint256 maxReservedUsd);
    error InsufficientReserveForOpenInterest(uint256 reservedUsd, uint256 maxReservedUsd);
    error UnableToGetOppositeToken(address inputToken, address market);
    error UnexpectedTokenForVirtualInventory(address token, address market);
    error EmptyMarketTokenSupply();
    error InvalidSwapMarket(address market);
    error UnableToGetCachedTokenPrice(address token, address market);
    error CollateralAlreadyClaimed(uint256 adjustedClaimableAmount, uint256 claimedAmount);
    error OpenInterestCannotBeUpdatedForSwapOnlyMarket(address market);
    error MaxOpenInterestExceeded(uint256 openInterest, uint256 maxOpenInterest);
    error MaxPoolAmountExceeded(uint256 poolAmount, uint256 maxPoolAmount);
    error MaxPoolAmountForDepositExceeded(uint256 poolAmount, uint256 maxPoolAmountForDeposit);
    error UnexpectedBorrowingFactor(uint256 positionBorrowingFactor, uint256 cumulativeBorrowingFactor);
    error UnableToGetBorrowingFactorEmptyPoolUsd();
    error UnableToGetFundingFactorEmptyOpenInterest();
    error InvalidPositionMarket(address market);
    error InvalidCollateralTokenForMarket(address market, address token);
    error PnlFactorExceededForLongs(int256 pnlToPoolFactor, uint256 maxPnlFactor);
    error PnlFactorExceededForShorts(int256 pnlToPoolFactor, uint256 maxPnlFactor);
    error InvalidUiFeeFactor(uint256 uiFeeFactor, uint256 maxUiFeeFactor);
    error EmptyAddressInMarketTokenBalanceValidation(address market, address token);
    error InvalidMarketTokenBalance(address market, address token, uint256 balance, uint256 expectedMinBalance);
    error InvalidMarketTokenBalanceForCollateralAmount(
        address market,
        address token,
        uint256 balance,
        uint256 collateralAmount
    );
    error InvalidMarketTokenBalanceForClaimableFunding(
        address market,
        address token,
        uint256 balance,
        uint256 claimableFundingFeeAmount
    );
    error UnexpectedPoolValue(int256 poolValue);

    // Oracle errors
    error EmptySigner(uint256 signerIndex);
    error InvalidBlockNumber(uint256 minOracleBlockNumber, uint256 currentBlockNumber);
    error InvalidMinMaxBlockNumber(uint256 minOracleBlockNumber, uint256 maxOracleBlockNumber);
    error HasRealtimeFeedId(address token, bytes32 feedId);
    error InvalidRealtimeFeedLengths(uint256 tokensLength, uint256 dataLength);
    error EmptyRealtimeFeedId(address token);
    error InvalidRealtimeFeedId(address token, bytes32 feedId, bytes32 expectedFeedId);
    error InvalidRealtimeBidAsk(address token, int192 bid, int192 ask);
    error InvalidRealtimeBlockHash(address token, bytes32 blockHash, bytes32 expectedBlockHash);
    error InvalidRealtimePrices(address token, int192 bid, int192 ask);
    error RealtimeMaxPriceAgeExceeded(address token, uint256 oracleTimestamp, uint256 currentTimestamp);
    error MaxPriceAgeExceeded(uint256 oracleTimestamp, uint256 currentTimestamp);
    error MinOracleSigners(uint256 oracleSigners, uint256 minOracleSigners);
    error MaxOracleSigners(uint256 oracleSigners, uint256 maxOracleSigners);
    error BlockNumbersNotSorted(uint256 minOracleBlockNumber, uint256 prevMinOracleBlockNumber);
    error MinPricesNotSorted(address token, uint256 price, uint256 prevPrice);
    error MaxPricesNotSorted(address token, uint256 price, uint256 prevPrice);
    error EmptyPriceFeedMultiplier(address token);
    error EmptyRealtimeFeedMultiplier(address token);
    error InvalidFeedPrice(address token, int256 price);
    error PriceFeedNotUpdated(address token, uint256 timestamp, uint256 heartbeatDuration);
    error MaxSignerIndex(uint256 signerIndex, uint256 maxSignerIndex);
    error InvalidOraclePrice(address token);
    error InvalidSignerMinMaxPrice(uint256 minPrice, uint256 maxPrice);
    error InvalidMedianMinMaxPrice(uint256 minPrice, uint256 maxPrice);
    error NonEmptyTokensWithPrices(uint256 tokensWithPricesLength);
    error InvalidMinMaxForPrice(address token, uint256 min, uint256 max);
    error EmptyPriceFeed(address token);
    error PriceAlreadySet(address token, uint256 minPrice, uint256 maxPrice);
    error MaxRefPriceDeviationExceeded(
        address token,
        uint256 price,
        uint256 refPrice,
        uint256 maxRefPriceDeviationFactor
    );
    error InvalidBlockRangeSet(uint256 largestMinBlockNumber, uint256 smallestMaxBlockNumber);

    // OracleModule errors
    error InvalidPrimaryPricesForSimulation(uint256 primaryTokensLength, uint256 primaryPricesLength);
    error EndOfOracleSimulation();

    // OracleUtils errors
    error EmptyCompactedPrice(uint256 index);
    error EmptyCompactedBlockNumber(uint256 index);
    error EmptyCompactedTimestamp(uint256 index);
    error UnsupportedOracleBlockNumberType(uint256 oracleBlockNumberType);
    error InvalidSignature(address recoveredSigner, address expectedSigner);

    error EmptyPrimaryPrice(address token);

    error OracleBlockNumbersAreSmallerThanRequired(uint256[] oracleBlockNumbers, uint256 expectedBlockNumber);
    error OracleBlockNumberNotWithinRange(
        uint256[] minOracleBlockNumbers,
        uint256[] maxOracleBlockNumbers,
        uint256 blockNumber
    );

    // BaseOrderUtils errors
    error EmptyOrder();
    error UnsupportedOrderType();
    error InvalidOrderPrices(
        uint256 primaryPriceMin,
        uint256 primaryPriceMax,
        uint256 triggerPrice,
        uint256 orderType
    );
    error EmptySizeDeltaInTokens();
    error PriceImpactLargerThanOrderSize(int256 priceImpactUsd, uint256 sizeDeltaUsd);
    error NegativeExecutionPrice(
        int256 executionPrice,
        uint256 price,
        uint256 positionSizeInUsd,
        int256 priceImpactUsd,
        uint256 sizeDeltaUsd
    );
    error OrderNotFulfillableAtAcceptablePrice(uint256 price, uint256 acceptablePrice);

    // IncreaseOrderUtils errors
    error UnexpectedPositionState();

    // OrderUtils errors
    error OrderTypeCannotBeCreated(uint256 orderType);
    error OrderAlreadyFrozen();

    // OrderStoreUtils errors
    error OrderNotFound(bytes32 key);

    // SwapOrderUtils errors
    error UnexpectedMarket();

    // DecreasePositionCollateralUtils errors
    error InsufficientFundsToPayForCosts(uint256 remainingCostUsd, string step);
    error InvalidOutputToken(address tokenOut, address expectedTokenOut);

    // DecreasePositionUtils errors
    error InvalidDecreaseOrderSize(uint256 sizeDeltaUsd, uint256 positionSizeInUsd);
    error UnableToWithdrawCollateral(int256 estimatedRemainingCollateralUsd);
    error InvalidDecreasePositionSwapType(uint256 decreasePositionSwapType);
    error PositionShouldNotBeLiquidated(
        string reason,
        int256 remainingCollateralUsd,
        int256 minCollateralUsd,
        int256 minCollateralUsdForLeverage
    );

    // IncreasePositionUtils errors
    error InsufficientCollateralAmount(uint256 collateralAmount, int256 collateralDeltaAmount);
    error InsufficientCollateralUsd(int256 remainingCollateralUsd);

    // PositionStoreUtils errors
    error PositionNotFound(bytes32 key);

    // PositionUtils errors
    error LiquidatablePosition(
        string reason,
        int256 remainingCollateralUsd,
        int256 minCollateralUsd,
        int256 minCollateralUsdForLeverage
    );

    error EmptyPosition();
    error InvalidPositionSizeValues(uint256 sizeInUsd, uint256 sizeInTokens);
    error MinPositionSize(uint256 positionSizeInUsd, uint256 minPositionSizeUsd);

    // PositionPricingUtils errors
    error UsdDeltaExceedsLongOpenInterest(int256 usdDelta, uint256 longOpenInterest);
    error UsdDeltaExceedsShortOpenInterest(int256 usdDelta, uint256 shortOpenInterest);

    // SwapPricingUtils errors
    error UsdDeltaExceedsPoolValue(int256 usdDelta, uint256 poolUsd);

    // RoleModule errors
    error Unauthorized(address msgSender, string role);

    // RoleStore errors
    error ThereMustBeAtLeastOneRoleAdmin();
    error ThereMustBeAtLeastOneTimelockMultiSig();

    // ExchangeRouter errors
    error InvalidClaimFundingFeesInput(uint256 marketsLength, uint256 tokensLength);
    error InvalidClaimCollateralInput(uint256 marketsLength, uint256 tokensLength, uint256 timeKeysLength);
    error InvalidClaimAffiliateRewardsInput(uint256 marketsLength, uint256 tokensLength);
    error InvalidClaimUiFeesInput(uint256 marketsLength, uint256 tokensLength);

    // SwapUtils errors
    error InvalidTokenIn(address tokenIn, address market);
    error InsufficientOutputAmount(uint256 outputAmount, uint256 minOutputAmount);
    error InsufficientSwapOutputAmount(uint256 outputAmount, uint256 minOutputAmount);
    error DuplicatedMarketInSwapPath(address market);
    error SwapPriceImpactExceedsAmountIn(uint256 amountAfterFees, int256 negativeImpactAmount);

    // SubaccountRouter errors
    error InvalidReceiverForSubaccountOrder(address receiver, address expectedReceiver);

    // SubaccountUtils errors
    error SubaccountNotAuthorized(address account, address subaccount);
    error MaxSubaccountActionCountExceeded(address account, address subaccount, uint256 count, uint256 maxCount);

    // TokenUtils errors
    error EmptyTokenTranferGasLimit(address token);
    error TokenTransferError(address token, address receiver, uint256 amount);
    error EmptyHoldingAddress();

    // AccountUtils errors
    error EmptyAccount();
    error EmptyReceiver();

    // Array errors
    error CompactedArrayOutOfBounds(
        uint256[] compactedValues,
        uint256 index,
        uint256 slotIndex,
        string label
    );

    error ArrayOutOfBoundsUint256(
        uint256[] values,
        uint256 index,
        string label
    );

    error ArrayOutOfBoundsBytes(
        bytes[] values,
        uint256 index,
        string label
    );

    // WithdrawalStoreUtils errors
    error WithdrawalNotFound(bytes32 key);

    // WithdrawalUtils errors
    error EmptyWithdrawal();
    error EmptyWithdrawalAmount();
    error MinLongTokens(uint256 received, uint256 expected);
    error MinShortTokens(uint256 received, uint256 expected);
    error InsufficientMarketTokens(uint256 balance, uint256 expected);
    error InsufficientWntAmount(uint256 wntAmount, uint256 executionFee);
    error InvalidPoolValueForWithdrawal(int256 poolValue);

    // Uint256Mask errors
    error MaskIndexOutOfBounds(uint256 index, string label);
    error DuplicatedIndex(uint256 index, string label);

    // =============== Functions ==============

    function getMarketTokenPrice(
        IGmxDataStore _dataStore,
        GmxMarket.MarketProps memory _market,
        GmxPrice.PriceProps memory _indexTokenPrice,
        GmxPrice.PriceProps memory _longTokenPrice,
        GmxPrice.PriceProps memory _shortTokenPrice,
        bytes32 _pnlFactorType,
        bool _maximize
    )
        external
        view
        returns (int256, GmxMarketPoolValueInfo.PoolValueInfoProps memory);

    function getDeposit(
        IGmxDataStore _dataStore,
        bytes32 _key
    )
        external
        view
        returns (GmxDeposit.DepositProps memory);

    function getWithdrawal(
        IGmxDataStore _dataStore,
        bytes32 _key
    )
        external
        view
        returns (GmxWithdrawal.WithdrawalProps memory);

    function getPnlToPoolFactor(
        IGmxDataStore _dataStore,
        address _marketAddress,
        GmxMarket.MarketPrices memory _prices,
        bool _isLong,
        bool _maximize
    ) external view returns (int256);

    function getSwapPriceImpact(
        IGmxDataStore _dataStore,
        address _marketKey,
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        GmxPrice.PriceProps memory _tokenInPrice,
        GmxPrice.PriceProps memory _tokenOutPrice
    ) external view returns (int256, int256);
}
