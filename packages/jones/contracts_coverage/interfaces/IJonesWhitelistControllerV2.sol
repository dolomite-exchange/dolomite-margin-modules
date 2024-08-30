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
 * @title   IJonesWhitelistControllerV2
 * @author  Dolomite
 *
 * @notice  Interface for Jones DAO's whitelist controller (0xDe3476a7C0a408325385605203665A8836c2bcca).
 */
interface IJonesWhitelistControllerV2 {

    struct RoleInfo {
        bool BYPASS_COOLDOWN; // solhint-disable-line var-name-mixedcase
        uint256 INCENTIVE_RETENTION; // solhint-disable-line var-name-mixedcase
    }

    function createRole(bytes32 _roleName, RoleInfo memory _roleInfo) external;

    function addToRole(bytes32 _roleName, address _account) external;

    function removeUserFromRole(address _account) external;

    function addToWhitelist(address _account) external;

    function removeFromWhitelist(address _account) external;

    function getUserRole(address _account) external view returns (bytes32);

    function getRoleInfo(bytes32 _role) external view returns (RoleInfo memory);

    function isWhitelistedContract(address _account) external view returns (bool);
}
