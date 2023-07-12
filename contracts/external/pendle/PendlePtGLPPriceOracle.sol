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

import {IDolomiteMargin} from "../../protocol/interfaces/IDolomiteMargin.sol";
import {IDolomitePriceOracle} from "../../protocol/interfaces/IDolomitePriceOracle.sol";
import {IDolomiteStructs} from "../../protocol/interfaces/IDolomiteStructs.sol";

import {Require} from "../../protocol/lib/Require.sol";

import {IPendleGLPRegistry} from "../interfaces/pendle/IPendleGLPRegistry.sol";

/**
 * @title   PendlePtGLPPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Pendle's ptGLP price in USD terms.
 */
contract PendlePtGLPPriceOracle is IDolomitePriceOracle {
    // ============================ Constants ============================

    bytes32 private constant _FILE = "PendlePtGLPPriceOracle";
    uint32 public constant TWAP_DURATION = 900; // 15 minutes
    uint256 public constant PT_ASSET_SCALE = 1e18; // 18 decimals

    // ============================ Public State Variables ============================

    address public immutable DPT_GLP; // solhint-disable-line var-name-mixedcase
    IPendleGLPRegistry public immutable REGISTRY; // solhint-disable-line var-name-mixedcase
    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    uint256 public immutable DFS_GLP_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dptGlp,
        address _pendleGLPRegistry,
        address _dolomiteMargin,
        uint256 _dfsGlpMarketId
    ) {
        DPT_GLP = _dptGlp;
        REGISTRY = IPendleGLPRegistry(_pendleGLPRegistry);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        DFS_GLP_MARKET_ID = _dfsGlpMarketId;

        (
            bool increaseCardinalityRequired,
            ,
            bool oldestObservationSatisfied
        ) = REGISTRY.ptOracle().getOracleState(
                address(REGISTRY.ptGlpMarket()),
                TWAP_DURATION
            );

        Require.that(
            !increaseCardinalityRequired && oldestObservationSatisfied,
            _FILE,
            "Oracle not ready yet"
        );
    }

    function getPrice(
        address _token
    ) public view returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(DPT_GLP),
            _FILE,
            "invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(
                DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)
            ),
            _FILE,
            "ptGLP cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({value: _getCurrentPrice()});
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 glpPrice = DOLOMITE_MARGIN
            .getMarketPrice(DFS_GLP_MARKET_ID)
            .value;
        uint256 ptExchangeRate = REGISTRY.ptOracle().getPtToAssetRate(
            address(REGISTRY.ptGlpMarket()),
            TWAP_DURATION
        );
        return (glpPrice * ptExchangeRate) / PT_ASSET_SCALE;
    }
}
