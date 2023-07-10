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

import { IERC4626 } from "../interfaces/IERC4626.sol";


/**
 * @title   MagicGLPPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Abra's MagicGLP price in USD terms.
 */
contract MagicGLPPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "MagicGLPPriceOracle";

    // ============================ Public State Variables ============================

    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    IERC4626 immutable public MAGIC_GLP; // solhint-disable-line var-name-mixedcase
    uint256 immutable public DFS_GLP_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _magicGlp,
        uint256 _dfsGlpMarketId
    ) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        MAGIC_GLP = IERC4626(_magicGlp);
        DFS_GLP_MARKET_ID = _dfsGlpMarketId;
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_token == address(MAGIC_GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(_token == address(MAGIC_GLP),
            _FILE,
            "invalid token",
            _token
        );
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "magicGLP cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 glpPrice = DOLOMITE_MARGIN.getMarketPrice(DFS_GLP_MARKET_ID).value;
        uint256 totalSupply = MAGIC_GLP.totalSupply();
        if (totalSupply == 0) {
            // exchange rate is 1 if the total supply is 0
            return glpPrice;
        }
        return glpPrice * MAGIC_GLP.totalAssets() / totalSupply;
    }
}
