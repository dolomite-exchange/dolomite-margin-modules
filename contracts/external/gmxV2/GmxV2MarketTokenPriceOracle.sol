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
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";

import { Market } from "../interfaces/gmx/GmxMarket.sol";
import { Price } from "../interfaces/gmx/GmxPrice.sol";
import { MarketPoolValueInfo } from "../interfaces/gmx/GmxMarketPoolValueInfo.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";

/**
 * @title   GmxV2MarketTokenPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets GMX's V2 Market token price in USD
 */
contract GmxV2MarketTokenPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GmxV2MarketTokenPriceOracle";
    uint256 public constant ETH_USD_PRECISION = 1e18;
    uint256 public constant FEE_PRECISION = 10_000;
    uint256 public constant DECIMAL_ADJUSTMENT = 6;

    bytes32 public constant MAX_PNL_FACTOR_FOR_WITHDRAWALS = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_WITHDRAWALS"));

    // ============================ Public State Variables ============================

    // @note Revisit naming conventions
    address public immutable DGM_ETH_USD; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV2 public immutable REGISTRY; // solhint-disable-line var-name-mixedcase
    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dGmEthUsd,
        address _gmxRegistryV2,
        address _dolomiteMargin
    ) {
        DGM_ETH_USD = _dGmEthUsd;
        REGISTRY = IGmxRegistryV2(_gmxRegistryV2);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        // @follow-up How do we change this to allow any GM token
        Require.that(
            _token == address(DGM_ETH_USD),
            _FILE,
            "Invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "gmEthUsd cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(DGM_ETH_USD);
        IGmxV2IsolationModeVaultFactory.TokenAndMarketParams memory info = factory.getMarketInfo();

        uint256 indexTokenPrice = DOLOMITE_MARGIN.getMarketPrice(info.indexTokenMarketId).value;
        uint256 shortTokenPrice = DOLOMITE_MARGIN.getMarketPrice(info.shortTokenMarketId).value;
        uint256 longTokenPrice = DOLOMITE_MARGIN.getMarketPrice(info.longTokenMarketId).value;

        Market.Props memory marketProps = Market.Props(
            info.marketToken,
            info.indexToken,
            info.longToken,
            info.shortToken
        );

       // Dolomite returns price as 36 decimals - token decimals
       // GMX expects 30 decimals - token decimals so we divide by 10 ** 6
        Price.Props memory indexTokenPriceProps = Price.Props(
            indexTokenPrice / 10 ** DECIMAL_ADJUSTMENT,
            indexTokenPrice / 10 ** DECIMAL_ADJUSTMENT
        );

        Price.Props memory longTokenPriceProps = Price.Props(
            longTokenPrice / 10 ** DECIMAL_ADJUSTMENT,
            longTokenPrice / 10 ** DECIMAL_ADJUSTMENT
        );

        Price.Props memory shortTokenPriceProps = Price.Props(
            shortTokenPrice / 10 ** DECIMAL_ADJUSTMENT,
            shortTokenPrice / 10 ** DECIMAL_ADJUSTMENT
        );
       // @audit Are we worried about this precision loss?

        (int256 value, ) = REGISTRY.gmxReader().getMarketTokenPrice(
            REGISTRY.gmxDataStore(),
            marketProps,
            indexTokenPriceProps,
            longTokenPriceProps,
            shortTokenPriceProps,
            MAX_PNL_FACTOR_FOR_WITHDRAWALS,
            true
        );

        if (value > 0) {
            // @audit This appears to be 30 decimals. Does that matter?
            return uint256(value);
        }
        else {
            revert();
        }
    }
}
