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

// solhint-disable max-line-length
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IPendlePtWstETHIsolationModeTokenVaultV1 } from "../interfaces/pendle/IPendlePtWstETHIsolationModeTokenVaultV1.sol";
import { IPendlePtWstETHIsolationModeVaultFactory } from "../interfaces/pendle/IPendlePtWstETHIsolationModeVaultFactory.sol";
import { IPendleWstETHRegistry } from "../interfaces/pendle/IPendleWstETHRegistry.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";


/**
 * @title   PendlePtWstETHIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the ptWstETH (June 2024 & June 2025 expiration)
 *          token that can be used to credit a user's Dolomite balance.
 */
// solhint-enable max-line-length
contract PendlePtWstETHIsolationModeTokenVaultV1 is
    IPendlePtWstETHIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "PendlePtWstETHUserVaultV1";

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function registry() public view returns (IPendleWstETHRegistry) {
        return IPendlePtWstETHIsolationModeVaultFactory(VAULT_FACTORY()).pendleWstETHRegistry();
    }

    function dolomiteRegistry()
        public
        override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        return registry().syWstEthToken().paused();
    }
}
