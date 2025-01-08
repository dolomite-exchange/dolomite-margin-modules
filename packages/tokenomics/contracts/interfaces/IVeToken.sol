// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

    struct LockedBalance {
        uint256 amount;
        uint256 end;
    }

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function create_lock(
        uint256 _value,
        uint256 _lock_duration
    ) external returns (uint256);

    function create_lock_for(
        uint256 _value,
        uint256 _lock_duration,
        address _for
    ) external returns (uint256);

    /**
     * @notice  Adds underlying tokens to the corresponding ve-token
     *
     * @param  _id      The ID of the lock whose underlying amount will be added
     * @param  _amount  The amount of tokens to add to the lock
     */
    function increase_amount(uint256 _id, uint256 _amount) external;

    function locked(uint256 _veNftId) external view returns (LockedBalance memory);
}
