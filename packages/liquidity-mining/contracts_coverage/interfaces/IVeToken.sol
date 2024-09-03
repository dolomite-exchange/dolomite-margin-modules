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
 * @title   IVeToken
 * @author  Dolomite
 *
 * @notice  Interface for ve-tokens
 */
interface IVeToken {

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    /**
     * @notice  Adds underlying tokens to the corresponding ve-token
     *
     * @param  _id      The ID of the lock whose underlying amount will be added
     * @param  _amount  The amount of tokens to add to the lock
     */
    function addToLock(uint256 _id, uint256 _amount) external;
}
