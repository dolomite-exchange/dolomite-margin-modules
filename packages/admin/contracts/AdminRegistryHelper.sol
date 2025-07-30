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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
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

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _dolomiteRegistry
    ) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ===================================================================
    // ========================== Modifiers =============================
    // ===================================================================

    modifier checkPermission(bytes4 _selector) {
        _checkPermission(_selector);
        _;
    }

    // ===================================================================
    // ========================= Internal Functions ======================
    // ===================================================================

    function _checkPermission(bytes4 _selector) internal view {
        IAdminRegistry adminRegistry = IAdminRegistry(DOLOMITE_REGISTRY.adminRegistry());
        Require.that(
            adminRegistry.hasPermission(_selector, address(this), msg.sender),
            _FILE,
            "Caller does not have permission"
        );
    }
}
