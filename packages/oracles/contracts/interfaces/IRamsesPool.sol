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
 * @title   IRamsesPool
 * @author  Dolomite
 *
 * @notice  Interface for Ramses legacy pools
 */
interface IRamsesPool {

    function observations(
        uint256 _index
    )
    external
    view
    returns (
        uint256 timestamp,
        uint256 reserve0Cumulative,
        uint256 reserve1Cumulative
    );

    function current(
        address tokenIn,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    function observationLength() external view returns (uint256);

    function token0() external view returns (address);

    function token1() external view returns (address);
}
