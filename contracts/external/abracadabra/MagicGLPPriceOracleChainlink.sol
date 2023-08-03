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

import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IERC4626 } from "../interfaces/IERC4626.sol";

/**
 * @title   MagicGLPPriceOracleChainlink
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Abra's MagicGLP price in USD terms using Chainlink Automation
 */
contract MagicGLPPriceOracleChainlink is IDolomitePriceOracle, AutomationCompatibleInterface {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "MagicGLPPriceOracleChainlink";
    uint256 public constant HEARTBEAT = 12 * 3600;

    // ============================ Public State Variables ============================

    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    IERC4626 immutable public MAGIC_GLP; // solhint-disable-line var-name-mixedcase
    uint256 immutable public DFS_GLP_MARKET_ID; // solhint-disable-line var-name-mixedcase
    address immutable public CHAINLINK_REGISTRY; // solhint-disable-line var-name-mixedcase

    uint256 private exchangeRate;
    uint256 public latestTimestamp;

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _magicGlp,
        uint256 _dfsGlpMarketId,
        address _chainlinkRegistry
    ) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        MAGIC_GLP = IERC4626(_magicGlp);
        DFS_GLP_MARKET_ID = _dfsGlpMarketId;
        CHAINLINK_REGISTRY = _chainlinkRegistry;

        latestTimestamp = block.timestamp;
        exchangeRate = _getCurrentPrice();
    }

    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory /* performData */) {
//        Require.that(
//           msg.sender == address(0),
//            _FILE,
//            "static rpc calls only"
//        );

        upkeepNeeded = _checkUpkeepConditions();
    }

    function performUpkeep(bytes calldata performData) external {
        Require.that(
            msg.sender == CHAINLINK_REGISTRY,
            _FILE,
            "caller is not Chainlink"
        );
        Require.that(
            _checkUpkeepConditions(),
            _FILE,
            "checkUpkeep conditions not met"
        );
        exchangeRate = _getCurrentPrice();
        latestTimestamp = block.timestamp;
    }

    function getPrice(address _token) public view returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(MAGIC_GLP),
            _FILE,
            "invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "magicGLP cannot be borrowable"
        );
        Require.that(
            latestTimestamp + HEARTBEAT > block.timestamp,
            _FILE,
            "price expired"
        );

        // Maybe fail if wide margin between cached price and real one
        return IDolomiteStructs.MonetaryPrice({
            value: exchangeRate
        });
    }

    // ============================ Internal Functions ============================

    function _checkUpkeepConditions() internal view returns (bool) {
        uint256 currentPrice = _getCurrentPrice();
        uint256 _exchangeRate = exchangeRate;
        uint256 upperEdge = _exchangeRate * 10025 / 10000;
        uint256 lowerEdge = _exchangeRate * 9975 / 10000;
        return (currentPrice >= upperEdge || currentPrice <= lowerEdge || block.timestamp > latestTimestamp + HEARTBEAT);
    }

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
