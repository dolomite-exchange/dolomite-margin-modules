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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IAdminRegistry } from "./interfaces/IAdminRegistry.sol";


/**
 * @title   AdminRegistryHelper
 * @author  Dolomite
 *
 * @notice  AdminRegistryHelper contract to store AdminRegistry and check permissions
 */
abstract contract AdminRegistryHelper {

    bytes32 private constant _FILE = "AdminRegistryHelper";

    // ===================================================================
    // ======================= Field Variables ===========================
    // ===================================================================

    IAdminRegistry public immutable ADMIN_REGISTRY;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _adminRegistry
    ) {
        ADMIN_REGISTRY = IAdminRegistry(_adminRegistry);
    }

    // ===================================================================
    // ========================== Modifiers =============================
    // ===================================================================

    modifier checkPermission(bytes4 _selector, address _caller) {
        _checkPermission(_selector, _caller);
        _;
    }

    // ===================================================================
    // ========================= Internal Functions ======================
    // ===================================================================

    function _checkPermission(bytes4 _selector, address _caller) internal view {
        if (ADMIN_REGISTRY.hasPermission(_selector, address(this), _caller)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            ADMIN_REGISTRY.hasPermission(_selector, address(this), _caller),
            _FILE,
            "Caller does not have permission",
            _caller
        );
    }
}
