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
 * @title   IGmxRoleStore
 * @author  Dolomite
 *
 * @notice  GMX RoleStore interface
 */
interface IGmxRoleStore {

    /**
     * @dev Returns the members of the specified role.
     *
     * @param  _roleKey The key of the role.
     * @param  _start   The start index, the value for this index will be included.
     * @param  _end     The end index, the value for this index will not be included.
     * @return          The members of the role.
     */
    function getRoleMembers(bytes32 _roleKey, uint256 _start, uint256 _end) external view returns (address[] memory);

    function hasRole(address _account, bytes32 _roleKey) external view returns (bool);
}
