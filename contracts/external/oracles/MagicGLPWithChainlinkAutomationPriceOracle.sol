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

import "./ChainlinkAutomationPriceOracle.sol";
import {IDolomiteMargin} from "../../protocol/interfaces/IDolomiteMargin.sol";
import {IDolomiteStructs} from "../../protocol/interfaces/IDolomiteStructs.sol";

import {Require} from "../../protocol/lib/Require.sol";

import {IERC4626} from "../interfaces/IERC4626.sol";

import "hardhat/console.sol";

/**
 * @title   MagicGLPWithChainlinkAutomationPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Abra's MagicGLP price in USD terms using Chainlink Automation
 */
contract MagicGLPWithChainlinkAutomationPriceOracle is ChainlinkAutomationPriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "MagicGLPWithChainlinkPriceOracle";

    // ============================ Public State Variables ============================

    IERC4626 immutable public MAGIC_GLP; // solhint-disable-line var-name-mixedcase
    uint256 immutable public DFS_GLP_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _chainlinkRegistry,
        address _magicGlp,
        uint256 _dfsGlpMarketId
    ) ChainlinkAutomationPriceOracle(_dolomiteMargin, _chainlinkRegistry){
        MAGIC_GLP = IERC4626(_magicGlp);
        DFS_GLP_MARKET_ID = _dfsGlpMarketId;

        _updateExchangeRateAndTimestamp();
    }

    function getPrice(address _token) public view returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(MAGIC_GLP),
            _FILE,
            "invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "magicGLP cannot be borrowable"
        );
        Require.that(
            latestTimestamp + HEARTBEAT + GRACE_PERIOD > block.timestamp,
            _FILE,
            "price expired"
        );

        // Maybe fail if wide margin between cached price and real one
        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getExchangeRate() internal view override returns (uint256, uint256) {
        return (MAGIC_GLP.totalAssets(), MAGIC_GLP.totalSupply());
    }

    function _getCurrentPrice() internal view override returns (uint256) {
        uint256 glpPrice = DOLOMITE_MARGIN().getMarketPrice(DFS_GLP_MARKET_ID).value;
        uint256 totalSupply = MAGIC_GLP.totalSupply();
        if (totalSupply == 0) {
            // exchange rate is 1 if the total supply is 0
            return glpPrice;
        }
        return glpPrice * exchangeRateNumerator / exchangeRateDenominator;
    }
}
