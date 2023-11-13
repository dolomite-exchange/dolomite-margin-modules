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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IPendleWstETHRegistry } from "../interfaces/pendle/IPendleWstETHRegistry.sol";


/**
 * @title   PendlePtWstETHPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Pendle's ptGLP price in USD terms.
 */
contract PendlePtWstETHPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PendlePtWstETHPriceOracle";
    uint32 public constant TWAP_DURATION = 900; // 15 minutes
    uint256 public constant PT_ASSET_SCALE = 1e18; // 18 decimals

    // ============================ Public State Variables ============================

    address immutable public DPT_WST_ETH; // solhint-disable-line var-name-mixedcase
    IPendleWstETHRegistry immutable public REGISTRY; // solhint-disable-line var-name-mixedcase
    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    uint256 immutable public WST_ETH_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dptWstEth,
        address _pendleWSTETHRegistry,
        address _dolomiteMargin,
        uint256 _dWstEthMarketId
    ) {
        DPT_WST_ETH = _dptWstEth;
        REGISTRY = IPendleWstETHRegistry(_pendleWSTETHRegistry);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        WST_ETH_MARKET_ID = _dWstEthMarketId;

        (
            bool increaseCardinalityRequired,,
            bool oldestObservationSatisfied
        ) = REGISTRY.ptOracle().getOracleState(address(REGISTRY.ptWstEth2024Market()), TWAP_DURATION);
        // @follow-up Handle different markets

        if (!increaseCardinalityRequired && oldestObservationSatisfied) { /* FOR COVERAGE TESTING */ }
        Require.that(!increaseCardinalityRequired && oldestObservationSatisfied,
            _FILE,
            "Oracle not ready yet"
        );
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_token == address(DPT_WST_ETH)) { /* FOR COVERAGE TESTING */ }
        Require.that(_token == address(DPT_WST_ETH),
            _FILE,
            "invalid token",
            _token
        );
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "ptWstEth cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 wstEthPrice = DOLOMITE_MARGIN.getMarketPrice(WST_ETH_MARKET_ID).value;
        // @follow-up How to handle different markets
        uint256 ptExchangeRate = REGISTRY.ptOracle().getPtToAssetRate(address(REGISTRY.ptWstEth2024Market()), TWAP_DURATION);
        return wstEthPrice * ptExchangeRate / PT_ASSET_SCALE;
    }
}
