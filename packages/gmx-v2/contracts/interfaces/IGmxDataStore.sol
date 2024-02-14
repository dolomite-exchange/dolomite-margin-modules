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

import { IGmxRoleStore } from "./IGmxRoleStore.sol";


/**
 * @title   IGmxDataStore
 * @author  Dolomite
 *
 * @notice  GMX DataStore interface
 */
interface IGmxDataStore {

    function setUint(bytes32 _key, uint256 _value) external returns (uint256);

    function setBool(bytes32 _key, bool _bool) external returns (bool);

    function getBool(bytes32 _key) external view returns (bool);

    function getUint(bytes32 _key) external view returns (uint256);

    function roleStore() external view returns (IGmxRoleStore);
}
