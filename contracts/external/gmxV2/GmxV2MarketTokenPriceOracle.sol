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

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { GmxMarket } from "../interfaces/gmx/GmxMarket.sol";
import { GmxPrice } from "../interfaces/gmx/GmxPrice.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2MarketTokenPriceOracle } from "../interfaces/gmx/IGmxV2MarketTokenPriceOracle.sol";
import { IGmxV2Registry } from "../interfaces/gmx/IGmxV2Registry.sol";


/**
 * @title   GmxV2MarketTokenPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets GMX's V2 Market token price in USD
 */
contract GmxV2MarketTokenPriceOracle is IGmxV2MarketTokenPriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GmxV2MarketTokenPriceOracle";
    /// @dev All of the GM tokens listed have, at-worst, 20 bp for the price deviation
    uint256 public constant PRICE_DEVIATION_BP = 25;
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant SUPPLY_CAP_USAGE_NUMERATOR = 5;
    uint256 public constant SUPPLY_CAP_USAGE_DENOMINATOR = 100;
    uint256 public constant GMX_DECIMAL_ADJUSTMENT = 10 ** 6;
    uint256 public constant RETURN_DECIMAL_ADJUSTMENT = 10 ** 12;
    uint256 public constant FEE_FACTOR_DECIMAL_ADJUSTMENT = 10 ** 26;

    bytes32 public constant MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_WITHDRAWALS")); // solhint-disable-line max-line-length
    bytes32 public constant SWAP_FEE_FACTOR_KEY = keccak256(abi.encode("SWAP_FEE_FACTOR"));
    bytes32 public constant SWAP_FEE_RECEIVER_FACTOR_KEY = keccak256(abi.encode("SWAP_FEE_RECEIVER_FACTOR"));

    // ============================ Public State Variables ============================

    IGmxV2Registry public immutable REGISTRY; // solhint-disable-line var-name-mixedcase

    mapping(address => bool) public marketTokens;

    // ============================ Constructor ============================

    constructor(
        address _gmxV2Registry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        REGISTRY = IGmxV2Registry(_gmxV2Registry);
    }

    function ownerSetMarketToken(
        address _token,
        bool _status
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMarketToken(_token, _status);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            marketTokens[_token],
            _FILE,
            "Invalid token",
            _token
        );

        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "gmToken cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice(_token)
        });
    }

    function getFeeBpByMarketToken(address _gmToken) public view returns (uint256) {
        bytes32 key = _swapFeeFactorKey(_gmToken, /* _forPositiveImpact = */ false);
        return REGISTRY.gmxDataStore().getUint(key) / FEE_FACTOR_DECIMAL_ADJUSTMENT;
    }

    // ============================ Internal Functions ============================

    function _ownerSetMarketToken(address _token, bool _status) internal {
        Require.that(
            IERC20Metadata(_token).decimals() == 18,
            _FILE,
            "Invalid market token decimals"
        );
        marketTokens[_token] = _status;
        emit MarketTokenSet(_token, _status);
    }

    function _getCurrentPrice(address _token) internal view returns (uint256) {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(_token);

        uint256 longTokenPrice = DOLOMITE_MARGIN().getMarketPrice(factory.LONG_TOKEN_MARKET_ID()).value;
        GmxPrice.PriceProps memory longTokenPriceProps = GmxPrice.PriceProps({
            min: _adjustDownForBasisPoints(longTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT,
            max: _adjustUpForBasisPoints(longTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT
        });

        uint256 shortTokenPrice = DOLOMITE_MARGIN().getMarketPrice(factory.SHORT_TOKEN_MARKET_ID()).value;
        GmxPrice.PriceProps memory shortTokenPriceProps = GmxPrice.PriceProps({
            min: _adjustDownForBasisPoints(shortTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT,
            max: _adjustUpForBasisPoints(shortTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT
        });

        uint256 gmPrice = _getGmTokenPrice(factory, longTokenPriceProps, shortTokenPriceProps);

        // @audit - Do you think this is a good way to think about the oracle price if we become a market leader for
        //          underwriting GM tokens?

        uint256 gmPriceAfterPriceImpact = _getGmTokenPriceAfterPriceImpact(
            gmPrice,
            factory,
            longTokenPriceProps,
            shortTokenPriceProps
        );

        return _adjustDownForBasisPoints(gmPriceAfterPriceImpact, getFeeBpByMarketToken(factory.UNDERLYING_TOKEN()));
    }

    function _getGmTokenPriceAfterPriceImpact(
        uint256 _gmPrice,
        IGmxV2IsolationModeVaultFactory _factory,
        GmxPrice.PriceProps memory _longTokenPriceProps,
        GmxPrice.PriceProps memory _shortTokenPriceProps
    ) internal view returns (uint256) {
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_factory));
        uint256 gmAmountIn = DOLOMITE_MARGIN().getMarketMaxWei(marketId).value;
        if (gmAmountIn == 0) {
            // GUARD STATEMENT
            // If the value is 0, that means there's on cap so we can just return the GM token price
            return _gmPrice;
        }

        // Assume under the worst case, we liquidate 10% of the supply cap (which would entail a swap for half of that,
        // 5%, to USDC (short token)).
        uint256 wethAmountIn = gmAmountIn * _gmPrice / (_longTokenPriceProps.max * GMX_DECIMAL_ADJUSTMENT);
        uint256 wethAmountInAdj = wethAmountIn * SUPPLY_CAP_USAGE_NUMERATOR / SUPPLY_CAP_USAGE_DENOMINATOR;

        // We generally will liquidate into USDC which is why we measure price impact from long to short token
        (, int256 wethPriceImpact) = REGISTRY.gmxReader().getSwapPriceImpact(
            REGISTRY.gmxDataStore(),
            _factory.UNDERLYING_TOKEN(),
            /* _tokenIn = */ _factory.LONG_TOKEN(),
            /* _tokenOut = */ _factory.SHORT_TOKEN(),
            wethAmountInAdj,
            /* _tokenInPrice  = */ _longTokenPriceProps,
            /* _tokenOutPrice  = */ _shortTokenPriceProps
        );

        if (wethPriceImpact < 0) {
            uint256 wethPriceImpactAbs = uint256(wethPriceImpact * -1);
            // @audit - Am I using price impact properly? It's measured in terms of WETH units, not %-age, right?
            return _gmPrice - (_gmPrice * wethPriceImpactAbs / wethAmountInAdj);
        } else {
            // For positive price impact, we don't care to add it to the price.
            return _gmPrice;
        }
    }

    function _getGmTokenPrice(
        IGmxV2IsolationModeVaultFactory _factory,
        GmxPrice.PriceProps memory _longTokenPriceProps,
        GmxPrice.PriceProps memory _shortTokenPriceProps
    ) internal view returns (uint256) {
        // @audit - We use Chainlink for all of these prices
        uint256 indexTokenPrice = DOLOMITE_MARGIN().getMarketPrice(_factory.INDEX_TOKEN_MARKET_ID()).value;

        GmxMarket.MarketProps memory marketProps = GmxMarket.MarketProps({
            marketToken: _factory.UNDERLYING_TOKEN(),
            indexToken: _factory.INDEX_TOKEN(),
            longToken: _factory.LONG_TOKEN(),
            shortToken: _factory.SHORT_TOKEN()
        });

        // @audit Are we worried about this precision loss?
        // Dolomite returns price as 36 decimals - token decimals
        // GMX expects 30 decimals - token decimals so we divide by 10 ** 6
        GmxPrice.PriceProps memory indexTokenPriceProps = GmxPrice.PriceProps({
            min: _adjustDownForBasisPoints(indexTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT,
            max: _adjustUpForBasisPoints(indexTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT
        });


        // @audit - we set maximize to false to get the "bid" price. Is this the correct way to think about it?
        (int256 value, ) = REGISTRY.gmxReader().getMarketTokenPrice(
            REGISTRY.gmxDataStore(),
            marketProps,
            indexTokenPriceProps,
            _longTokenPriceProps,
            _shortTokenPriceProps,
            MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY,
            /* _maximize = */ false
        );

        // @audit Is there a better way to handle this? When could the reader return negative here?
        Require.that(
            value > 0,
            _FILE,
            "Invalid oracle response"
        );

        // GMX returns the price in 30 decimals. We convert to (36 - GM token decimals == 18) for Dolomite's system
        return uint256(value) / RETURN_DECIMAL_ADJUSTMENT;
    }

    function _adjustDownForBasisPoints(uint256 _value, uint256 _basisPoints) internal pure returns (uint256) {
        return _value - (_value * _basisPoints / BASIS_POINTS);
    }

    function _adjustUpForBasisPoints(uint256 _value, uint256 _basisPoints) internal pure returns (uint256) {
        return _value + (_value * _basisPoints / BASIS_POINTS);
    }

    function _swapFeeFactorKey(address _marketToken, bool _forPositiveImpact) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SWAP_FEE_FACTOR_KEY,
                _marketToken,
                _forPositiveImpact
            )
        );
    }
}
