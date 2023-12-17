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
 * @title   IJonesGLPAdapter
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Jones DAO's GLP adapter (0x42EfE3E686808ccA051A49BCDE34C5CbA2EBEfc1). The
 *          adapter serves as the primary entry/exit point for users looking to mint/redeem jUSDC.
 */
interface IJonesGLPAdapter {

    function depositStable(uint256 _assets, bool _compound) external returns (uint256);
}
