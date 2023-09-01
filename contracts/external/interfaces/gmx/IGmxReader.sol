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


import { DataStore } from "./GmxDataStore.sol";
import { Market } from "./GmxMarket.sol";
import { Price } from "./GmxPrice.sol";
import { MarketPoolValueInfo } from "./GmxMarketPoolValueInfo.sol";


/**
 * @title   IGmxReader
 * @author  Dolomite
 *
 * @notice  GMX Reader Interface
 */
interface IGmxReader {

    function getMarketTokenPrice(
        DataStore dataStore,
        Market.Props memory market,
        Price.Props memory indexTokenPrice,
        Price.Props memory longTokenPrice,
        Price.Props memory shortTokenPrice,
        bytes32 pnlFactorType,
        bool maximize
    ) external view returns (int256, MarketPoolValueInfo.Props memory);
}
