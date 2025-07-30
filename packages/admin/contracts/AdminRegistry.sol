// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IAdminRegistry } from "./interfaces/IAdminRegistry.sol";


/**
 * @title   AdminRegistry
 * @author  Dolomite
 *
 * @notice  AdminRegistry contract to track roles and permissions across Dolomite admin contracts
 */
contract AdminRegistry is AccessControl, OnlyDolomiteMargin, IAdminRegistry {

    bytes32 private constant _FILE = "AdminRegistry";

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
    }

    // ===================================================================
    // ========================= Admin Functions =========================
    // ===================================================================

    function grantRole(
        bytes4 _selector,
        address _contract,
        address _account
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _grantRole(role(_selector, _contract), _account);
    }

    function revokeRole(
        bytes4 _selector,
        address _contract,
        address _account
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _revokeRole(role(_selector, _contract), _account);
    }

    // ===================================================================
    // ========================= View Functions ==========================
    // ===================================================================

    function role(bytes4 _selector, address _contract) public pure returns (bytes32) {
        return bytes32(_selector) | bytes32(uint256(uint160(_contract)));
    }

    function hasPermission(bytes4 _selector, address _contract, address _account) external view returns (bool) {
        return hasRole(role(_selector, _contract), _account);
    }
}
