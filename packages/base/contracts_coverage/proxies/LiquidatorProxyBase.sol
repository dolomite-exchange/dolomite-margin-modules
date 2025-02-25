// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2022 Dolomite.

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

import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { HasLiquidatorRegistry } from "../general/HasLiquidatorRegistry.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { DolomiteVersionLib } from "../lib/DolomiteVersionLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { BitsLib } from "../protocol/lib/BitsLib.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";
import { Time } from "../protocol/lib/Time.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";


/**
 * @title   LiquidatorProxyBase
 * @author  Dolomite
 *
 * Inheritable contract that allows sharing code across different liquidator proxy contracts
 */
abstract contract LiquidatorProxyBase is HasLiquidatorRegistry {
    using DolomiteVersionLib for *;
    using SafeMath for uint;
    using TypesLib for IDolomiteStructs.Par;

    // ============ Constants ============

    bytes32 private constant _FILE = "LiquidatorProxyBase";
    uint256 private constant MAX_UINT_BITS = 256;
    uint256 private constant ONE = 1;

    // ============ Structs ============

    struct MarketInfo {
        uint256 marketId;
        IDolomiteStructs.MonetaryPrice price;
        IDolomiteStructs.InterestIndex index;
    }

    struct LiquidatorProxyConstants {
        IDolomiteMargin dolomiteMargin;
        IDolomiteStructs.AccountInfo solidAccount;
        IDolomiteStructs.AccountInfo liquidAccount;
        uint256 heldMarket;
        uint256 owedMarket;
        MarketInfo[] markets;
        uint256[] liquidMarkets;
        IExpiry expiryProxy;
        uint32 expiry;
    }

    struct LiquidatorProxyCache {
        // mutable
        uint256 owedWeiToLiquidate;
        // The amount of heldMarket the solidAccount will receive. Includes the liquidation reward. Useful as the
        // `amountIn` for a trade
        uint256 solidHeldUpdateWithReward;
        IDolomiteStructs.Wei solidHeldWei;
        IDolomiteStructs.Wei solidOwedWei;
        IDolomiteStructs.Wei liquidHeldWei;
        IDolomiteStructs.Wei liquidOwedWei;
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

    // ============ Fields ============

    uint256 public chainId;

    // ============ Internal Functions ============

    constructor(
        uint256 _chainId,
        address _liquidatorAssetRegistry
    ) HasLiquidatorRegistry(_liquidatorAssetRegistry) {
        chainId = _chainId;
    }

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
        if (_constants.expiry != 0) {
            (, IDolomiteStructs.MonetaryPrice memory owedPricePrice) = _constants.expiryProxy.getExpirySpreadAdjustedPricesForChain(
                chainId,
                _constants.liquidAccount,
                _constants.heldMarket,
                _constants.owedMarket,
                _constants.expiry
            );
            owedPriceAdj = owedPricePrice.value;
        } else {
            IDolomiteStructs.Decimal memory spread = _constants.dolomiteMargin.getLiquidationSpreadForChainAndPair(
                chainId,
                _constants.liquidAccount,
                _constants.heldMarket,
                _constants.owedMarket
            );
            owedPriceAdj = owedMarketInfo.price.value.add(DecimalLib.mul(owedMarketInfo.price.value, spread));
        }

        return LiquidatorProxyCache({
            owedWeiToLiquidate: 0,
            solidHeldUpdateWithReward: 0,
            solidHeldWei: InterestIndexLib.parToWei(
                _constants.dolomiteMargin.getAccountPar(_constants.solidAccount, _constants.heldMarket),
                heldMarketInfo.index
            ),
            solidOwedWei: InterestIndexLib.parToWei(
                _constants.dolomiteMargin.getAccountPar(_constants.solidAccount, _constants.owedMarket),
                owedMarketInfo.index
            ),
            liquidHeldWei: InterestIndexLib.parToWei(
                _constants.dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.heldMarket),
                heldMarketInfo.index
            ),
            liquidOwedWei: InterestIndexLib.parToWei(
                _constants.dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.owedMarket),
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
        LiquidatorProxyConstants memory _constants,
        uint256 _expiry
    )
    internal
    view
    {
        // panic if the developer didn't set these variables already
        /*assert(address(_constants.dolomiteMargin) != address(0));*/
        /*assert(_constants.solidAccount.owner != address(0));*/
        /*assert(_constants.liquidAccount.owner != address(0));*/

        if (_constants.owedMarket != _constants.heldMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.owedMarket != _constants.heldMarket,
            _FILE,
            "Owed market equals held market",
            _constants.owedMarket
        );

        if (!_constants.dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.owedMarket).isPositive()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !_constants.dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.owedMarket).isPositive(),
            _FILE,
            "Owed market cannot be positive",
            _constants.owedMarket
        );

        if (_constants.dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.heldMarket).isPositive()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.dolomiteMargin.getAccountPar(_constants.liquidAccount, _constants.heldMarket).isPositive(),
            _FILE,
            "Held market cannot be negative",
            _constants.heldMarket
        );

        if (uint32(_expiry) == _expiry) { /* FOR COVERAGE TESTING */ }
        Require.that(
            uint32(_expiry) == _expiry,
            _FILE,
            "Expiry overflows",
            _expiry
        );

        if (_expiry <= Time.currentTime()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _expiry <= Time.currentTime(),
            _FILE,
            "Borrow not yet expired",
            _expiry
        );
    }

    /**
     * Make some basic checks before attempting to liquidate an account.
     *  - Require that the msg.sender has the permission to use the solid account
     *  - Require that the expiration timestamp matches the real expiry, if processing an expiration
     */
    function _checkBasicRequirements(
        LiquidatorProxyConstants memory _constants
    )
    internal
    view
    {
        // check credentials for msg.sender
        if (_constants.solidAccount.owner == msg.sender || _constants.dolomiteMargin.getIsLocalOperator(_constants.solidAccount.owner, msg.sender)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _constants.solidAccount.owner == msg.sender
                || _constants.dolomiteMargin.getIsLocalOperator(_constants.solidAccount.owner, msg.sender),
            _FILE,
            "Sender not operator",
            msg.sender
        );

        if (_constants.expiry != 0) {
            // check the expiration is valid; to get here we already know constants.expiry != 0
            uint32 expiry = _constants.expiryProxy.getExpiry(_constants.liquidAccount, _constants.owedMarket);
            if (expiry == _constants.expiry) { /* FOR COVERAGE TESTING */ }
            Require.that(
                expiry == _constants.expiry,
                _FILE,
                "Expiry mismatch",
                expiry,
                _constants.expiry
            );
        }
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
        uint256 liquidHeldValue = _cache.heldPrice.mul(_cache.liquidHeldWei.value);
        uint256 liquidOwedValue = _cache.owedPriceAdj.mul(_cache.liquidOwedWei.value);
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
        uint256 _minOutputAmountWei,
        LiquidatorProxyCache memory _cache
    )
        internal
        pure
        returns (uint256 _newMinOutputAmountWei)
    {
        // at this point, _cache.owedWeiToLiquidate should be the max amount that can be liquidated on the user.
        /*assert(_cache.owedWeiToLiquidate != 0);*/ // assert it was initialized

        // @follow-up @Corey, This is different from the BaseLiquidatorProxy.sol implementation.
        _newMinOutputAmountWei = _minOutputAmountWei;

        if (_newMinOutputAmountWei == type(uint256).max) {
            _newMinOutputAmountWei = _cache.owedWeiToLiquidate;
        } else if (_newMinOutputAmountWei < _cache.owedWeiToLiquidate) {
            _cache.owedWeiToLiquidate = _newMinOutputAmountWei;
            _cache.solidHeldUpdateWithReward = DolomiteMarginMath.getPartial(
                _newMinOutputAmountWei,
                _cache.owedPriceAdj,
                _cache.heldPrice
            );
        }
    }

    /**
     * Returns true if the supplyValue over-collateralizes the borrowValue by the ratio.
     */
    function _isCollateralized(
        uint256 supplyValue,
        uint256 borrowValue,
        IDolomiteStructs.Decimal memory ratio
    )
    internal
    pure
    returns (bool)
    {
        uint256 requiredMargin = DecimalLib.mul(borrowValue, ratio);
        return supplyValue >= borrowValue.add(requiredMargin);
    }

    /**
     * Gets the current total supplyValue and borrowValue for some account. Takes into account what
     * the current index will be once updated.
     */
    function _getAccountValues(
        IDolomiteMargin dolomiteMargin,
        MarketInfo[] memory marketInfos,
        IDolomiteStructs.AccountInfo memory account,
        uint256[] memory marketIds,
        IDolomiteStructs.Decimal memory marginRatioOverride
    )
    internal
    view
    returns (
        IDolomiteStructs.MonetaryValue memory,
        IDolomiteStructs.MonetaryValue memory
    )
    {
        return _getAccountValues(
            dolomiteMargin,
            marketInfos,
            account,
            marketIds,
            /* adjustForMarginPremiums = */ false, // solium-disable-line indentation
            marginRatioOverride
        );
    }

    function _getAdjustedAccountValues(
        IDolomiteMargin dolomiteMargin,
        MarketInfo[] memory marketInfos,
        IDolomiteStructs.AccountInfo memory account,
        uint256[] memory marketIds,
        IDolomiteStructs.Decimal memory marginRatioOverride
    )
    internal
    view
    returns (
        IDolomiteStructs.MonetaryValue memory,
        IDolomiteStructs.MonetaryValue memory
    )
    {
        return _getAccountValues(
            dolomiteMargin,
            marketInfos,
            account,
            marketIds,
            /* adjustForMarginPremiums = */ true, // solium-disable-line indentation
            marginRatioOverride
        );
    }

    function _getMarketInfos(
        IDolomiteMargin dolomiteMargin,
        uint256[] memory solidMarkets,
        uint256[] memory liquidMarkets
    ) internal view returns (MarketInfo[] memory) {
        uint256[] memory marketBitmaps = BitsLib.createBitmaps(dolomiteMargin.getNumMarkets());
        uint256 marketsLength = 0;
        marketsLength = _addMarketsToBitmap(solidMarkets, marketBitmaps, marketsLength);
        marketsLength = _addMarketsToBitmap(liquidMarkets, marketBitmaps, marketsLength);

        uint256 counter;
        MarketInfo[] memory marketInfos = new MarketInfo[](marketsLength);
        for (uint256 i; i < marketBitmaps.length; ++i) {
            uint256 bitmap = marketBitmaps[i];
            while (bitmap != 0) {
                uint256 nextSetBit = BitsLib.getLeastSignificantBit(bitmap);
                uint256 marketId = BitsLib.getMarketIdFromBit(i, nextSetBit);

                marketInfos[counter++] = MarketInfo({
                    marketId: marketId,
                    price: dolomiteMargin.getMarketPrice(marketId),
                    index: dolomiteMargin.getMarketCurrentIndex(marketId)
                });

                // unset the set bit
                bitmap = BitsLib.unsetBit(bitmap, nextSetBit);
            }
            if (counter == marketsLength) {
                break;
            }
        }

        return marketInfos;
    }

    function _binarySearch(
        MarketInfo[] memory markets,
        uint256 marketId
    ) internal pure returns (MarketInfo memory) {
        return _binarySearch(
            markets,
            0,
            markets.length,
            marketId
        );
    }

    // ============ Private Functions ============

    // solium-disable-next-line security/no-assign-params
    function _getAccountValues(
        IDolomiteMargin dolomiteMargin,
        MarketInfo[] memory marketInfos,
        IDolomiteStructs.AccountInfo memory account,
        uint256[] memory marketIds,
        bool adjustForMarginPremiums,
        IDolomiteStructs.Decimal memory marginRatioOverride
    )
    private
    view
    returns (
        IDolomiteStructs.MonetaryValue memory supplyValue,
        IDolomiteStructs.MonetaryValue memory borrowValue
    )
    {

        // Only adjust for liquidity if prompted AND if there is no override
        adjustForMarginPremiums = adjustForMarginPremiums && marginRatioOverride.value == 0;

        for (uint256 i; i < marketIds.length; ++i) {
            IDolomiteStructs.Par memory par = dolomiteMargin.getAccountPar(account, marketIds[i]);
            MarketInfo memory marketInfo = _binarySearch(marketInfos, marketIds[i]);
            IDolomiteStructs.Wei memory userWei = InterestIndexLib.parToWei(par, marketInfo.index);
            uint256 assetValue = userWei.value.mul(marketInfo.price.value);
            IDolomiteStructs.Decimal memory marginPremium = DecimalLib.one();
            if (adjustForMarginPremiums) {
                marginPremium = DecimalLib.onePlus(dolomiteMargin.getMarketMarginPremium(marketIds[i]));
            }
            if (userWei.sign) {
                supplyValue.value = supplyValue.value.add(DecimalLib.div(assetValue, marginPremium));
            } else {
                borrowValue.value = borrowValue.value.add(DecimalLib.mul(assetValue, marginPremium));
            }
        }

        return (supplyValue, borrowValue);
    }

    // solium-disable-next-line security/no-assign-params
    function _addMarketsToBitmap(
        uint256[] memory markets,
        uint256[] memory bitmaps,
        uint256 marketsLength
    ) private pure returns (uint) {
        for (uint256 i; i < markets.length; ++i) {
            if (!BitsLib.hasBit(bitmaps, markets[i])) {
                BitsLib.setBit(bitmaps, markets[i]);
                marketsLength += 1;
            }
        }
        return marketsLength;
    }

    function _binarySearch(
        MarketInfo[] memory markets,
        uint256 beginInclusive,
        uint256 endExclusive,
        uint256 marketId
    ) private pure returns (MarketInfo memory) {
        uint256 len = endExclusive - beginInclusive;
        // solium-disable indentation
        /* ignore-coverage */ Require.that(
            len != 0 && (len != 1 || markets[beginInclusive].marketId == marketId),
            _FILE,
            "Market not found"
        );
        // solium-enable indentation

        // Calculate the mid
        uint256 mid = beginInclusive + (len >> 1);
        uint256 midMarketId = markets[mid].marketId;
        if (marketId < midMarketId) {
            return _binarySearch(
                markets,
                beginInclusive,
                mid,
                marketId
            );
        } else if (marketId > midMarketId) {
            return _binarySearch(
                markets,
                mid + 1,
                endExclusive,
                marketId
            );
        } else {
            return markets[mid];
        }
    }

}
