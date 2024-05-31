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
 * @title   IDeltaSwapPair
 * @author  Dolomite
 *
 * @notice  This interface defines the functions that are available on DeltaSwapPairs
 */
interface IDeltaSwapPair {

    function mint(address _to) external returns (uint256);

    function swap(uint256 _amount0Out, uint256 _amount1Out, address _to, bytes calldata _data) external;

    function token0() external view returns (address);

    function token1() external view returns (address);

    function kLast() external view returns (uint256);

    function getReserves() external view returns (uint112, uint112, uint32);

    function totalSupply() external view returns (uint256);

    function factory() external view returns (address);
}
