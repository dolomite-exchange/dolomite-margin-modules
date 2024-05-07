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


/**
 * @title   IRamsesCLPool
 * @author  Dolomite
 *
 * @notice  Interface for Ramses Concentrated Liquidity Pools
 */
interface IRamsesCLPool {

    function observe(
        uint32[] calldata secondsAgos
    )
    external
    view
    returns (
        int56[] memory tickCumulatives,
        uint160[] memory secondsPerLiquidityCumulativesX128s,
        uint160[] memory secondsPerBoostedLiquidityPeriodX128s
    );

    function token0() external view returns (address);

    function token1() external view returns (address);
}
