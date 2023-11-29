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
 * @title   IDolomiteAmmFactory
 * @author  Dolomite
 *
 * @notice  This interface defines the functions that can be called for Dolomite's native AMM pools.
 */
interface IDolomiteAmmFactory {

    // ============================================
    // ============== Write Functions =============
    // ============================================

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;

    function setFeeToSetter(address) external;

    // ============================================
    // ============== Read Functions ==============
    // ============================================

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function dolomiteMargin() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);

    function allPairs(uint) external view returns (address pair);

    function allPairsLength() external view returns (uint);

    function getPairInitCode() external pure returns (bytes memory);

    function getPairInitCodeHash() external pure returns (bytes32);
}
