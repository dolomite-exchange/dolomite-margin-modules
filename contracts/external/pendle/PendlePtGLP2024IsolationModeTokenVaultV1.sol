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

import { IPendlePtGLP2024IsolationModeTokenVaultV1 } from "../interfaces/IPendlePtGLP2024IsolationModeTokenVaultV1.sol";
import { IPendlePtGLP2024IsolationModeVaultFactory } from "../interfaces/IPendlePtGLP2024IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";


/**
 * @title   PendlePtGLP2024IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the ptGLP (March 2024 expiration)
 *          token that can be used to credit a user's Dolomite balance.
 */
contract PendlePtGLP2024IsolationModeTokenVaultV1 is
    IPendlePtGLP2024IsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PendlePtGLP2024UserVaultV1";

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function isExternalRedemptionPaused() public override view returns (bool) {
        return IPendlePtGLP2024IsolationModeVaultFactory(VAULT_FACTORY())
            .pendlePtGLP2024Registry()
            .syGlpToken()
            .paused();
    }
}
