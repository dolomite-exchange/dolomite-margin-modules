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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithPausableAndOnlyEoa } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithPausableAndOnlyEoa.sol"; // solhint-disable-line max-line-length
import { IJonesUSDCIsolationModeTokenVaultV1 } from "./interfaces/IJonesUSDCIsolationModeTokenVaultV1.sol";
import { IJonesUSDCIsolationModeVaultFactory } from "./interfaces/IJonesUSDCIsolationModeVaultFactory.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";
import { IJonesWhitelistController } from "./interfaces/IJonesWhitelistController.sol";


/**
 * @title   JonesUSDCIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the plvGLP token that can be used
 *          to credit a user's Dolomite balance. plvGLP held in the vault is considered to be in isolation mode - that
 *          is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
// @todo fix overrides
contract JonesUSDCIsolationModeTokenVaultV1 is
    IJonesUSDCIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausableAndOnlyEoa
{
    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "JonesUSDCIsolationModeVaultV1";

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function registry() public view returns (IJonesUSDCRegistry) {
        return IJonesUSDCIsolationModeVaultFactory(VAULT_FACTORY()).jonesUSDCRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        IJonesWhitelistController whitelistController = registry().whitelistController();
        address unwrapperTrader = registry().unwrapperTraderForLiquidation();
        bytes32 unwrapperRole = whitelistController.getUserRole(unwrapperTrader);
        IJonesWhitelistController.RoleInfo memory unwrapperRoleInfo = whitelistController.getRoleInfo(unwrapperRole);

        // if the ecosystem is emergency paused (cannot process redemptions) or if instant redemptions are disabled or
        // if the contract is not whitelisted
        return !unwrapperRoleInfo.jUSDC_BYPASS_TIME
            || registry().glpVaultRouter().emergencyPaused()
            || !whitelistController.isWhitelistedContract(unwrapperTrader);
    }
}
