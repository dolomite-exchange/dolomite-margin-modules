// SPDX-License-Identifier: Apache 2.0
/*

    Copyright 2023 Dolomite.

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

import { HasLiquidatorRegistry } from "./HasLiquidatorRegistry.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { BitsLib } from "../../protocol/lib/BitsLib.sol";
import { DecimalLib } from "../../protocol/lib/DecimalLib.sol";
import { DolomiteMarginMath } from "../../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { TypesLib } from "../../protocol/lib/TypesLib.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";


/**
 * @title   BaseLiquidatorProxy
 * @author  Dolomite
 *
 * Inheritable contract that allows sharing code across different liquidator proxy contracts
 */
abstract contract BaseLiquidatorProxy is HasLiquidatorRegistry {
    using DecimalLib for IDolomiteMargin.Decimal;
    using TypesLib for IDolomiteMargin.Par;

    // ============ Structs ============

    struct MarketInfo {
        uint256 marketId;
        IDolomiteMargin.MonetaryPrice price;
        IDolomiteMargin.InterestIndex index;
    }

    struct LiquidatorProxyConstants {
        IDolomiteMargin.AccountInfo solidAccount;
        IDolomiteMargin.AccountInfo liquidAccount;
        uint256 heldMarket;
        uint256 owedMarket;
        MarketInfo[] markets;
        uint256[] liquidMarkets;
        uint256 expirationTimestamp;
    }

    struct LiquidatorProxyCache {
        // mutable
        uint256 owedWeiToLiquidate;
        // The amount of heldMarket the solidAccount will receive. Includes the liquidation reward. Useful as the
        // `amountIn` for a trade
        uint256 solidHeldUpdateWithReward;
        IDolomiteMargin.Wei solidHeldWei;
        IDolomiteMargin.Wei solidOwedWei;
        IDolomiteMargin.Wei liquidHeldWei;
        IDolomiteMargin.Wei liquidOwedWei;
        // This exists purely for expirations. If the amount being repaid is meant to be ALL but the value of the debt
        // is greater than the value of the collateral, then we need to flip the markets in the trade for the Target=0
        // encoding of the Amount. There's a rounding issue otherwise because amounts are calculated differently for
        // trades vs. liquidations
        bool flipMarketsForExpiration;

        // immutable
        uint256 heldPrice;
        uint256 owedPrice;
        uint256 owedPriceAdj;
    }

    // ============ Constants ============

    bytes32 private constant _FILE = "BaseLiquidatorProxy";

    // ============ Immutable Fields ============

    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    IExpiry public immutable EXPIRY; // solhint-disable-line var-name-mixedcase

    // ================ Constructor ===============

    constructor(
        address _dolomiteMargin,
        address _expiry,
        address _liquidatorAssetRegistry
    )
        HasLiquidatorRegistry(_liquidatorAssetRegistry)
    {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        EXPIRY = IExpiry(_expiry);
    }

    // ============ Internal Functions ============

    /**
     * Pre-populates cache values for some pair of markets.
     */
    function _initializeCache(
        LiquidatorProxyConstants memory _constants
    )
    internal
    view
    returns (LiquidatorProxyCache memory)
    {
        MarketInfo memory heldMarketInfo = _binarySearch(_constants.markets, _constants.heldMarket);
        MarketInfo memory owedMarketInfo = _binarySearch(_constants.markets, _constants.owedMarket);

        uint256 owedPriceAdj;
        if (_constants.expirationTimestamp > 0) {
            (, IDolomiteMargin.MonetaryPrice memory owedPricePrice) = EXPIRY.getSpreadAdjustedPrices(
                _constants.heldMarket,
                _constants.owedMarket,
                uint32(_constants.expirationTimestamp)
            );
            owedPriceAdj = owedPricePrice.value;
        } else {
            IDolomiteMargin.Decimal memory spread = DOLOMITE_MARGIN.getLiquidationSpreadForPair(
                _constants.heldMarket,
                _constants.owedMarket
            );
            owedPriceAdj = owedMarketInfo.price.value + DecimalLib.mul(owedMarketInfo.price.value, spread);
        }

        return LiquidatorProxyCache({
            owedWeiToLiquidate: 0,
            solidHeldUpdateWithReward: 0,
            solidHeldWei: InterestIndexLib.parToWei(
                DOLOMITE_MARGIN.getAccountPar(_constants.solidAccount, _constants.heldMarket),
                heldMarketInfo.index
            ),
            solidOwedWei: InterestIndexLib.parToWei(
                DOLOMITE_MARGIN.getAccountPar(_constants.solidAccount, _constants.owedMarket),
                owedMarketInfo.index
            ),
            liquidHeldWei: InterestIndexLib.parToWei(
                DOLOMITE_MARGIN.getAccountPar(_constants.liquidAccount, _constants.heldMarket),
                heldMarketInfo.index
            ),
            liquidOwedWei: InterestIndexLib.parToWei(
                DOLOMITE_MARGIN.getAccountPar(_constants.liquidAccount, _constants.owedMarket),
                owedMarketInfo.index
            ),
            flipMarketsForExpiration: false,
            heldPrice: heldMarketInfo.price.value,
            owedPrice: owedMarketInfo.price.value,
            owedPriceAdj: owedPriceAdj
        });
    }

    /**
     * Make some basic checks before attempting to liquidate an account.
     *  - Require that the msg.sender has the permission to use the liquidator account
     *  - Require that the liquid account is liquidatable based on the accounts global value (all assets held and owed,
     *    not just what's being liquidated)
     */
    function _checkConstants(
        LiquidatorProxyConstants memory _constants
    )
    internal
    view
    {
        // panic if the developer didn't set these variables already
        /*assert(_constants.solidAccount.owner != address(0));*/
        /*assert(_constants.liquidAccount.owner != address(0));*/

        if (_constants.owedMarket != _constants.heldMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.owedMarket != _constants.heldMarket,
            _FILE,
            "Owed market equals held market",
            _constants.owedMarket
        );

        if (!DOLOMITE_MARGIN.getAccountPar(_constants.liquidAccount, _constants.owedMarket).isPositive()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !DOLOMITE_MARGIN.getAccountPar(_constants.liquidAccount, _constants.owedMarket).isPositive(),
            _FILE,
            "Owed market cannot be positive",
            _constants.owedMarket
        );

        if (DOLOMITE_MARGIN.getAccountPar(_constants.liquidAccount, _constants.heldMarket).isPositive()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN.getAccountPar(_constants.liquidAccount, _constants.heldMarket).isPositive(),
            _FILE,
            "Held market cannot be negative",
            _constants.heldMarket
        );

        if (uint32(_constants.expirationTimestamp) == _constants.expirationTimestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(
            uint32(_constants.expirationTimestamp) == _constants.expirationTimestamp,
            _FILE,
            "Expiration timestamp overflows",
            _constants.expirationTimestamp
        );

        if (_constants.expirationTimestamp <= block.timestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.expirationTimestamp <= block.timestamp,
            _FILE,
            "Borrow not yet expired",
            _constants.expirationTimestamp
        );
    }

    /**
     * Make some basic checks before attempting to liquidate an account.
     *  - Require that the msg.sender has the permission to use the solid account
     *  - Require that the liquid account is liquidatable if using an expiration timestamp
     */
    function _checkBasicRequirements(
        LiquidatorProxyConstants memory _constants
    )
    internal
    view
    {
        // check credentials for msg.sender
        if (_constants.solidAccount.owner == msg.sender || DOLOMITE_MARGIN.getIsLocalOperator(_constants.solidAccount.owner, msg.sender)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.solidAccount.owner == msg.sender
                || DOLOMITE_MARGIN.getIsLocalOperator(_constants.solidAccount.owner, msg.sender),
            _FILE,
            "Sender not operator",
            msg.sender
        );

        if (_constants.expirationTimestamp != 0) {
            // check the expiration is valid
            uint32 expirationTimestamp = EXPIRY.getExpiry(_constants.liquidAccount, _constants.owedMarket);
            if (expirationTimestamp == _constants.expirationTimestamp) { /* FOR COVERAGE TESTING */ }
            Require.that(
                expirationTimestamp == _constants.expirationTimestamp,
                _FILE,
                "Expiration timestamp mismatch",
                expirationTimestamp,
                _constants.expirationTimestamp
            );
        }
    }

    /**
     * Gets the current total supplyValue and borrowValue for some account. Takes into account what
     * the current index will be once updated.
     */
    function _getAccountValues(
        MarketInfo[] memory _marketInfos,
        IDolomiteMargin.AccountInfo memory _account,
        uint256[] memory _marketIds
    )
    internal
    view
    returns (
        IDolomiteMargin.MonetaryValue memory supplyValue,
        IDolomiteMargin.MonetaryValue memory borrowValue
    )
    {
        return _getAccountValues(
            _marketInfos,
            _account,
            _marketIds,
            /* _adjustForMarginPremiums = */ false
        );
    }

    /**
     * Gets the adjusted current total supplyValue and borrowValue for some account. Takes into account what
     * the current index will be once updated and the margin premium.
     */
    function _getAdjustedAccountValues(
        MarketInfo[] memory _marketInfos,
        IDolomiteMargin.AccountInfo memory _account,
        uint256[] memory _marketIds
    )
    internal
    view
    returns (
        IDolomiteMargin.MonetaryValue memory supplyValue,
        IDolomiteMargin.MonetaryValue memory borrowValue
    )
    {
        return _getAccountValues(
            _marketInfos,
            _account,
            _marketIds,
            /* _adjustForMarginPremiums = */ true
        );
    }

    function _getMarketInfos(
        uint256[] memory _solidMarketIds,
        uint256[] memory _liquidMarketIds
    ) internal view returns (MarketInfo[] memory) {
        uint[] memory marketBitmaps = BitsLib.createBitmaps(DOLOMITE_MARGIN.getNumMarkets());
        uint256 marketsLength = 0;
        marketsLength = _addMarketsToBitmap(_solidMarketIds, marketBitmaps, marketsLength);
        marketsLength = _addMarketsToBitmap(_liquidMarketIds, marketBitmaps, marketsLength);

        uint256 counter = 0;
        MarketInfo[] memory marketInfos = new MarketInfo[](marketsLength);
        for (uint256 i; i < marketBitmaps.length && counter != marketsLength; ++i) {
            uint256 bitmap = marketBitmaps[i];
            while (bitmap != 0) {
                uint256 nextSetBit = BitsLib.getLeastSignificantBit(bitmap);
                uint256 marketId = BitsLib.getMarketIdFromBit(i, nextSetBit);

                marketInfos[counter++] = MarketInfo({
                    marketId: marketId,
                    price: DOLOMITE_MARGIN.getMarketPrice(marketId),
                    index: DOLOMITE_MARGIN.getMarketCurrentIndex(marketId)
                });

                // unset the set bit
                bitmap = BitsLib.unsetBit(bitmap, nextSetBit);
            }
        }

        return marketInfos;
    }

    /**
     * Calculate the maximum amount that can be liquidated on `liquidAccount`
     */
    function _calculateAndSetMaxLiquidationAmount(
        LiquidatorProxyCache memory _cache
    )
        internal
        pure
    {
        uint256 liquidHeldValue = _cache.heldPrice * _cache.liquidHeldWei.value;
        uint256 liquidOwedValue = _cache.owedPriceAdj * _cache.liquidOwedWei.value;
        if (liquidHeldValue < liquidOwedValue) {
            // The held collateral is worth less than the adjusted debt
            _cache.solidHeldUpdateWithReward = _cache.liquidHeldWei.value;
            _cache.owedWeiToLiquidate = DolomiteMarginMath.getPartialRoundUp(
                _cache.liquidHeldWei.value,
                _cache.heldPrice,
                _cache.owedPriceAdj
            );
            _cache.flipMarketsForExpiration = true;
        } else {
            _cache.solidHeldUpdateWithReward = DolomiteMarginMath.getPartial(
                _cache.liquidOwedWei.value,
                _cache.owedPriceAdj,
                _cache.heldPrice
            );
            _cache.owedWeiToLiquidate = _cache.liquidOwedWei.value;
        }
    }

    function _calculateAndSetActualLiquidationAmount(
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        LiquidatorProxyCache memory _cache
    )
        internal
        pure
        returns (uint256 _newInputAmountWei, uint256 _newMinOutputAmountWei)
    {
        // at this point, _cache.owedWeiToLiquidate should be the max amount that can be liquidated on the user.
        /*assert(_cache.owedWeiToLiquidate > 0);*/ // assert it was initialized

        uint256 desiredLiquidationOwedAmount = _minOutputAmountWei;
        if (
            desiredLiquidationOwedAmount < _cache.owedWeiToLiquidate
            && desiredLiquidationOwedAmount * _cache.owedPriceAdj < _cache.heldPrice * _cache.liquidHeldWei.value
        ) {
            // The user wants to liquidate less than the max amount, and the held collateral is worth more than the
            // desired debt to liquidate
            _cache.owedWeiToLiquidate = desiredLiquidationOwedAmount;
            _cache.solidHeldUpdateWithReward = DolomiteMarginMath.getPartial(
                desiredLiquidationOwedAmount,
                _cache.owedPriceAdj,
                _cache.heldPrice
            );
        }

        if (_inputAmountWei == type(uint256).max) {
            // This is analogous to saying "sell all of the collateral I receive from the liquidation"
            _newInputAmountWei = _cache.solidHeldUpdateWithReward;
        } else {
            _newInputAmountWei = _inputAmountWei;
        }

        if (_minOutputAmountWei == type(uint256).max) {
            // Setting the value to max uint256 is analogous to saying "liquidate all"
            _newMinOutputAmountWei = _cache.owedWeiToLiquidate;
        } else {
            _newMinOutputAmountWei = _minOutputAmountWei;
        }
    }

    /**
     * Returns true if the supplyValue over-collateralizes the borrowValue by the ratio.
     */
    function _isCollateralized(
        uint256 _supplyValue,
        uint256 _borrowValue,
        IDolomiteMargin.Decimal memory _ratio
    )
        internal
        pure
        returns (bool)
    {
        uint256 requiredMargin = DecimalLib.mul(_borrowValue, _ratio);
        return _supplyValue >= _borrowValue + requiredMargin;
    }

    function _binarySearch(
        MarketInfo[] memory _markets,
        uint256 _marketId
    ) internal pure returns (MarketInfo memory) {
        return _binarySearch(
            _markets,
            /* _beginInclusive = */ 0,
            _markets.length,
            _marketId
        );
    }

    // ============ Private Functions ============

    function _getAccountValues(
        MarketInfo[] memory _marketInfos,
        IDolomiteMargin.AccountInfo memory _account,
        uint256[] memory _marketIds,
        bool _adjustForMarginPremiums
    )
        private
        view
        returns (
            IDolomiteMargin.MonetaryValue memory supplyValue,
            IDolomiteMargin.MonetaryValue memory borrowValue
        )
    {
        for (uint256 i; i < _marketIds.length; ++i) {
            IDolomiteMargin.Par memory par = DOLOMITE_MARGIN.getAccountPar(_account, _marketIds[i]);
            MarketInfo memory marketInfo = _binarySearch(_marketInfos, _marketIds[i]);
            IDolomiteMargin.Wei memory userWei = InterestIndexLib.parToWei(par, marketInfo.index);
            uint256 assetValue = userWei.value * marketInfo.price.value;
            IDolomiteMargin.Decimal memory marginPremium = DecimalLib.one();
            if (_adjustForMarginPremiums) {
                marginPremium = DecimalLib.onePlus(DOLOMITE_MARGIN.getMarketMarginPremium(_marketIds[i]));
            }
            if (userWei.sign) {
                supplyValue.value = supplyValue.value + DecimalLib.div(assetValue, marginPremium);
            } else {
                borrowValue.value = borrowValue.value + DecimalLib.mul(assetValue, marginPremium);
            }
        }

        return (supplyValue, borrowValue);
    }

    function _addMarketsToBitmap(
        uint256[] memory _markets,
        uint256[] memory _bitmaps,
        uint256 _marketsLength
    ) private pure returns (uint) {
        for (uint256 i; i < _markets.length; ++i) {
            if (!BitsLib.hasBit(_bitmaps, _markets[i])) {
                BitsLib.setBit(_bitmaps, _markets[i]);
                _marketsLength += 1;
            }
        }
        return _marketsLength;
    }

    function _binarySearch(
        MarketInfo[] memory _markets,
        uint256 _beginInclusive,
        uint256 _endExclusive,
        uint256 _marketId
    ) private pure returns (MarketInfo memory) {
        uint256 len = _endExclusive - _beginInclusive;
        if (len == 0 || (len == 1 && _markets[_beginInclusive].marketId != _marketId)) {
            revert("BaseLiquidatorProxy: Market not found"); // solhint-disable-line reason-string
        }

        uint256 mid = _beginInclusive + len / 2;
        uint256 midMarketId = _markets[mid].marketId;
        if (_marketId < midMarketId) {
            return _binarySearch(
                _markets,
                _beginInclusive,
                mid,
                _marketId
            );
        } else if (_marketId > midMarketId) {
            return _binarySearch(
                _markets,
                mid + 1,
                _endExclusive,
                _marketId
            );
        } else {
            return _markets[mid];
        }
    }
}
