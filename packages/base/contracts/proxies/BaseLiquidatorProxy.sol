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

import { HasLiquidatorRegistry } from "../general/HasLiquidatorRegistry.sol";
import { ChainIdHelper } from "../helpers/ChainIdHelper.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { DolomiteMarginVersionWrapperLib } from "../lib/DolomiteMarginVersionWrapperLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { IDolomiteAccountRiskOverrideSetter } from "../protocol/interfaces/IDolomiteAccountRiskOverrideSetter.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   BaseLiquidatorProxy
 * @author  Dolomite
 *
 * Inheritable contract that allows sharing code across different liquidator proxy contracts
 */
abstract contract BaseLiquidatorProxy is ChainIdHelper, HasLiquidatorRegistry, OnlyDolomiteMargin {
    using DecimalLib for IDolomiteMargin.Decimal;
    using DecimalLib for uint256;
    using DolomiteMarginVersionWrapperLib for *;

    // ============ Events ============

    event DolomiteRakeSet(IDolomiteStructs.Decimal dolomiteRake);
    event PartialLiquidationThresholdSet(uint256 partialLiquidationThreshold);
    event PartialLiquidatorSet(address partialLiquidator, bool isPartialLiquidator);
    event MarketToPartialLiquidationSupportedSet(uint256[] marketIds, bool[] isSupported);

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
        bool dolomiteRake;
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
    uint256 internal constant _ONE = 1 ether;

    // ============ Immutable Fields ============

    IExpiry public immutable EXPIRY; // solhint-disable-line var-name-mixedcase
    IDolomiteAccountRiskOverrideSetter public immutable DOLOMITE_ACCOUNT_RISK_OVERRIDE; // solhint-disable-line var-name-mixedcase

    uint256 public partialLiquidationThreshold;
    mapping(uint256 => bool) public marketToPartialLiquidationSupported;
    mapping(address => bool) public whitelistedPartialLiquidators;
    IDolomiteStructs.Decimal public dolomiteRake;

    // ================ Constructor ===============

    constructor(
        address _dolomiteAccountRiskOverride,
        address _liquidatorAssetRegistry,
        address _dolomiteMargin,
        address _expiry,
        uint256 _chainId
    )
        ChainIdHelper(_chainId)
        HasLiquidatorRegistry(_liquidatorAssetRegistry)
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        EXPIRY = IExpiry(_expiry);
        DOLOMITE_ACCOUNT_RISK_OVERRIDE = IDolomiteAccountRiskOverrideSetter(_dolomiteAccountRiskOverride);
    }

    function ownerSetDolomiteRake(
        IDolomiteStructs.Decimal memory _dolomiteRake
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _dolomiteRake.value < _ONE,
            _FILE,
            "Invalid dolomite rake"
        );
        dolomiteRake = _dolomiteRake;
        emit DolomiteRakeSet(_dolomiteRake);
    }

    function ownerSetIsPartialLiquidator(
        address _partialLiquidator,
        bool _isPartialLiquidator
    ) external onlyDolomiteMarginOwner(msg.sender) {
        whitelistedPartialLiquidators[_partialLiquidator] = _isPartialLiquidator;
        emit PartialLiquidatorSet(_partialLiquidator, _isPartialLiquidator);
    }

    function ownerSetMarketToPartialLiquidationSupported(
        uint256[] memory _marketIds,
        bool[] memory _isSupported
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _marketIds.length == _isSupported.length,
            _FILE,
            "Invalid market IDs length"
        );
        for (uint256 i = 0; i < _marketIds.length; i++) {
            marketToPartialLiquidationSupported[_marketIds[i]] = _isSupported[i];
        }
        emit MarketToPartialLiquidationSupportedSet(_marketIds, _isSupported);
    }

    function ownerSetPartialLiquidationThreshold(
        uint256 _partialLiquidationThreshold
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _partialLiquidationThreshold < _ONE,
            _FILE,
            "Invalid partial threshold"
        );
        partialLiquidationThreshold = _partialLiquidationThreshold;
        emit PartialLiquidationThresholdSet(_partialLiquidationThreshold);
    }


    // ============ Internal Functions ============

    /**
     * Gets the current total supplyValue and borrowValue for some account. Takes into account what
     * the current index will be once updated.
     */
    function _getAccountValues(
        MarketInfo[] memory _marketInfos,
        IDolomiteMargin.AccountInfo memory _account,
        uint256[] memory _marketIds,
        IDolomiteMargin.Decimal memory _marginRatioOverride
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
            /* _adjustForMarginPremiums = */ false,
            _marginRatioOverride
        );
    }

    /**
     * Gets the adjusted current total supplyValue and borrowValue for some account. Takes into account what
     * the current index will be once updated and the margin premium.
     */
    function _getAdjustedAccountValues(
        MarketInfo[] memory _marketInfos,
        IDolomiteMargin.AccountInfo memory _account,
        uint256[] memory _marketIds,
        IDolomiteMargin.Decimal memory _marginRatioOverride
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
            /* _adjustForMarginPremiums = */ true,
            _marginRatioOverride
        );
    }

    /**
     * Calculate the maximum amount that can be liquidated on `liquidAccount`
     */
    function _calculateAndSetMaxLiquidationAmount(
        LiquidatorProxyCache memory _cache,
        LiquidatorProxyConstants memory _constants
    )
        internal
        view
    {
        if (_eligibleForPartialLiquidation(_constants)) {
            Require.that(
                whitelistedPartialLiquidators[msg.sender],
                _FILE,
                "Invalid partial liquidator"
            );
            _cache.liquidOwedWei.value = _cache.liquidOwedWei.value / 2;
        }

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

    function _eligibleForPartialLiquidation(
        LiquidatorProxyConstants memory _constants
    ) internal view returns (bool) {
        if (_constants.expirationTimestamp != 0 || !marketToPartialLiquidationSupported[_constants.heldMarket]) {
            return false;
        }

        (
            IDolomiteMargin.Decimal memory marginRatioOverride,
        ) = DOLOMITE_ACCOUNT_RISK_OVERRIDE.getAccountRiskOverride(_constants.liquidAccount);
        (
            IDolomiteMargin.MonetaryValue memory supplyValue,
            IDolomiteMargin.MonetaryValue memory borrowValue
        ) = _getAdjustedAccountValues(
            _constants.markets,
            _constants.liquidAccount,
            _constants.liquidMarkets,
            marginRatioOverride
        );

        if (marginRatioOverride.value == 0) {
            marginRatioOverride = DOLOMITE_MARGIN().getMarginRatio();
        }
        marginRatioOverride = marginRatioOverride.onePlus();

        uint256 collateralRatio = supplyValue.value * 1e18 / borrowValue.value;
        uint256 healthFactor = collateralRatio.div(marginRatioOverride);

        return partialLiquidationThreshold > 0 && healthFactor >= partialLiquidationThreshold;
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
        assert(_cache.owedWeiToLiquidate > 0); // assert it was initialized

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
        bool _adjustForMarginPremiums,
        IDolomiteMargin.Decimal memory _marginRatioOverride
    )
        private
        view
        returns (
            IDolomiteMargin.MonetaryValue memory supplyValue,
            IDolomiteMargin.MonetaryValue memory borrowValue
        )
    {

        // Only adjust for liquidity if prompted AND if there is no override
        _adjustForMarginPremiums = _adjustForMarginPremiums && _marginRatioOverride.value == 0;

        for (uint256 i; i < _marketIds.length; ++i) {
            IDolomiteMargin.Par memory par = DOLOMITE_MARGIN().getAccountPar(_account, _marketIds[i]);
            MarketInfo memory marketInfo = _binarySearch(_marketInfos, _marketIds[i]);
            IDolomiteMargin.Wei memory userWei = InterestIndexLib.parToWei(par, marketInfo.index);
            uint256 assetValue = userWei.value * marketInfo.price.value;
            IDolomiteMargin.Decimal memory marginPremium = DecimalLib.one();
            if (_adjustForMarginPremiums) {
                marginPremium = DecimalLib.onePlus(DOLOMITE_MARGIN().getMarketMarginPremium(_marketIds[i]));
            }
            if (userWei.sign) {
                supplyValue.value = supplyValue.value + DecimalLib.div(assetValue, marginPremium);
            } else {
                borrowValue.value = borrowValue.value + DecimalLib.mul(assetValue, marginPremium);
            }
        }

        return (supplyValue, borrowValue);
    }

    function _binarySearch(
        MarketInfo[] memory _markets,
        uint256 _beginInclusive,
        uint256 _endExclusive,
        uint256 _marketId
    ) internal pure returns (MarketInfo memory) {
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
