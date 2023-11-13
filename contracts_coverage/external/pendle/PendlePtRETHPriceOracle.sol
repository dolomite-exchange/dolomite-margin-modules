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

import { IPendleRETHRegistry } from "../interfaces/pendle/IPendleRETHRegistry.sol";


/**
 * @title   PendlePtRETHPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Pendle's ptGLP price in USD terms.
 */
contract PendlePtRETHPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PendlePtRETHPriceOracle";
    uint32 public constant TWAP_DURATION = 900; // 15 minutes
    uint256 public constant PT_ASSET_SCALE = 1e18; // 18 decimals

    // ============================ Public State Variables ============================

    address immutable public DPT_RETH; // solhint-disable-line var-name-mixedcase
    IPendleRETHRegistry immutable public REGISTRY; // solhint-disable-line var-name-mixedcase
    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    uint256 immutable public RETH_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dptRETH,
        address _pendleRETHRegistry,
        address _dolomiteMargin,
        uint256 _dRETHMarketId
    ) {
        DPT_RETH = _dptRETH;
        REGISTRY = IPendleRETHRegistry(_pendleRETHRegistry);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        RETH_MARKET_ID = _dRETHMarketId;

        (
            bool increaseCardinalityRequired,,
            bool oldestObservationSatisfied
        ) = REGISTRY.ptOracle().getOracleState(address(REGISTRY.ptRETHMarket()), TWAP_DURATION);

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
        if (_token == address(DPT_RETH)) { /* FOR COVERAGE TESTING */ }
        Require.that(_token == address(DPT_RETH),
            _FILE,
            "invalid token",
            _token
        );
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "ptRETH cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 rETHPrice = DOLOMITE_MARGIN.getMarketPrice(RETH_MARKET_ID).value;
        uint256 ptExchangeRate = REGISTRY.ptOracle().getPtToAssetRate(address(REGISTRY.ptRETHMarket()), TWAP_DURATION);
        return rETHPrice * ptExchangeRate / PT_ASSET_SCALE;
    }
}
