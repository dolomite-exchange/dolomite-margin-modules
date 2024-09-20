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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGmxDataStore } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxDataStore.sol";
import { IGlvIsolationModeVaultFactory } from "./interfaces/IGlvIsolationModeVaultFactory.sol";
import { IGlvReader } from "./interfaces/IGlvReader.sol";
import { IGlvRegistry } from "./interfaces/IGlvRegistry.sol";
import { IGlvTokenPriceOracle } from "./interfaces/IGlvTokenPriceOracle.sol";
import { GlvPrice } from "./lib/GlvPrice.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title   GlvTokenPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets GLV Token price in USD
 */
contract GlvTokenPriceOracle is IGlvTokenPriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GlvTokenPriceOracle";
    /// @dev All of the GM tokens listed have, at-worst, 25 bp for the price deviation
    uint256 public constant PRICE_DEVIATION_BP = 25;
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant GMX_DECIMAL_ADJUSTMENT = 10 ** 6;
    uint256 public constant RETURN_DECIMAL_ADJUSTMENT = 10 ** 12;
    uint256 public constant FEE_FACTOR_DECIMAL_ADJUSTMENT = 10 ** 26;

    bytes32 public constant SWAP_FEE_FACTOR_KEY = keccak256(abi.encode("SWAP_FEE_FACTOR"));

    // ============================ Public State Variables ============================

    IERC20 immutable public DGLV_TOKEN; // solhint-disable-line var-name-mixedcase
    IGlvRegistry public immutable REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dglvToken,
        address _glvRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DGLV_TOKEN = IERC20(_dglvToken);
        REGISTRY = IGlvRegistry(_glvRegistry);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_token == address(DGLV_TOKEN)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _token == address(DGLV_TOKEN),
            _FILE,
            "Invalid token",
            _token
        );
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "glvToken cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice(_token)
        });
    }

    /**
     *
     * @dev  This will always return the largest swap fee, which is the one considering the negative price impact
     */
    function getFeeBpByMarketToken(address _gmToken) public view returns (uint256) {
        bytes32 key = _swapFeeFactorKey(_gmToken, /* _forPositiveImpact = */ false);
        return REGISTRY.gmxDataStore().getUint(key) / FEE_FACTOR_DECIMAL_ADJUSTMENT;
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice(address _token) internal view returns (uint256) {
        IGlvIsolationModeVaultFactory factory = IGlvIsolationModeVaultFactory(_token);

        IDolomitePriceOracle aggregator = REGISTRY.dolomiteRegistry().oracleAggregator();
        uint256 longTokenPrice = aggregator.getPrice(factory.LONG_TOKEN()).value;
        GlvPrice.Props memory longTokenPriceProps = GlvPrice.Props({
            min: _adjustDownForBasisPoints(longTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT,
            max: _adjustUpForBasisPoints(longTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT
        });

        uint256 shortTokenPrice = aggregator.getPrice(factory.SHORT_TOKEN()).value;
        GlvPrice.Props memory shortTokenPriceProps = GlvPrice.Props({
            min: _adjustDownForBasisPoints(shortTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT,
            max: _adjustUpForBasisPoints(shortTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT
        });

        uint256 gmPrice = _getGmTokenPrice(factory, aggregator, longTokenPriceProps, shortTokenPriceProps);

        return _adjustDownForBasisPoints(gmPrice, getFeeBpByMarketToken(factory.UNDERLYING_TOKEN()));
    }

    function _getGmTokenPrice(
        IGlvIsolationModeVaultFactory _factory,
        IDolomitePriceOracle _aggregator,
        GlvPrice.Props memory _longTokenPriceProps,
        GlvPrice.Props memory _shortTokenPriceProps
    ) internal view returns (uint256) {
        address glvToken = _factory.UNDERLYING_TOKEN();
        IGmxDataStore dataStore = REGISTRY.gmxDataStore();
        IGlvReader.GlvInfo memory glvInfo = REGISTRY.glvReader().getGlvInfo(dataStore, glvToken);

        GlvPrice.Props[] memory indexTokenPriceProps = new GlvPrice.Props[](glvInfo.markets.length);
        for (uint256 i; i < glvInfo.markets.length; i++) {
            address indexToken = REGISTRY.gmxReader().getMarket(dataStore, glvInfo.markets[i]).indexToken;
            uint256 indexTokenPrice;
            // @todo Need shib price oracle from Chainlink
            if (indexToken == 0x3E57D02f9d196873e55727382974b02EdebE6bfd) {
                indexTokenPrice = 13937067 * GMX_DECIMAL_ADJUSTMENT;
            } else {
                indexTokenPrice = _aggregator.getPrice(indexToken).value;
            }
            indexTokenPriceProps[i] = GlvPrice.Props({
                // Dolomite returns price as 36 decimals - token decimals
                // GMX expects 30 decimals - token decimals so we divide by 10 ** 6
                min: _adjustDownForBasisPoints(indexTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT,
                max: _adjustUpForBasisPoints(indexTokenPrice, PRICE_DEVIATION_BP) / GMX_DECIMAL_ADJUSTMENT
            });
        }

        (uint256 value,, ) = REGISTRY.glvReader().getGlvTokenPrice(
            dataStore,
            glvInfo.markets,
            indexTokenPriceProps,
            _longTokenPriceProps,
            _shortTokenPriceProps,
            glvToken,
            /* _maximize = */ false
        );
        /*assert(value > 0);*/

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
