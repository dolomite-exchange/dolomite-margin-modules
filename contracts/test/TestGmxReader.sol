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

import { GmxMarket } from "../external/interfaces/gmx/GmxMarket.sol";
import { GmxMarketPoolValueInfo } from "../external/interfaces/gmx/GmxMarketPoolValueInfo.sol";
import { GmxPrice } from "../external/interfaces/gmx/GmxPrice.sol";
import { IGmxDataStore } from "../external/interfaces/gmx/IGmxDataStore.sol";

/**
 * @title   TestGmxReader
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxReader {

    bytes32 private constant _FILE = "TestGmxReader";

    int256 public shortPnlToPoolFactor;
    int256 public longPnlToPoolFactor;
    int256 public marketPrice;

    function setPnlToPoolFactors(int256 _shortPnlToPoolFactor, int256 _longPnlToPoolFactor) external {
        shortPnlToPoolFactor = _shortPnlToPoolFactor;
        longPnlToPoolFactor = _longPnlToPoolFactor;
    }

    function setMarketPrice(int256 _marketPrice) external {
        marketPrice = _marketPrice;
    }

    function getPnlToPoolFactor(
        IGmxDataStore /* dataStore */,
        address /* marketAddress */,
        GmxMarket.MarketPrices memory /* prices */,
        bool isLong,
        bool /* maximize */
    ) external view returns (int256) {
        return isLong ? longPnlToPoolFactor : shortPnlToPoolFactor;
    }

    function getMarketTokenPrice(
        IGmxDataStore /* _dataStore */,
        GmxMarket.Props memory /* _market */,
        GmxPrice.Props memory /* _indexTokenPrice */,
        GmxPrice.Props memory /* _longTokenPrice */,
        GmxPrice.Props memory /* _shortTokenPrice */,
        bytes32 /* _pnlFactorType */,
        bool /* _maximize */
    ) external view returns (int256, GmxMarketPoolValueInfo.Props memory) {
        GmxMarketPoolValueInfo.Props memory props = GmxMarketPoolValueInfo.Props(
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        );

        return (marketPrice, props);
    }
}
