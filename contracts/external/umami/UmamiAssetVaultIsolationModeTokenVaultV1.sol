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

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { IUmamiAssetVaultIsolationModeTokenVaultV1 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultIsolationModeVaultFactory } from "../interfaces/umami/IUmamiAssetVaultIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultRegistry } from "../interfaces/umami/IUmamiAssetVaultRegistry.sol";
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";


/**
 * @title   UmamiAssetVaultIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the Umami Delta Neutral Vault
 *          Token and credits a user's Dolomite balance. Assets held in the vault are considered to be in isolation mode
 *          they cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract UmamiAssetVaultIsolationModeTokenVaultV1 is
    IUmamiAssetVaultIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{
    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "UmamiVaultIsolationModeVaultV1"; // shortened to fit into 32 bytes

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function registry() public view returns (IUmamiAssetVaultRegistry) {
        return IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).umamiAssetVaultRegistry();
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        return Pausable(IUmamiAssetVaultIsolationModeVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN()).paused();
    }
}
