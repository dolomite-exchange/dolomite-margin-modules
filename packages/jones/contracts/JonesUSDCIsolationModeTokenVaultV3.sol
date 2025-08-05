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

import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { JonesUSDCIsolationModeTokenVaultV2 } from "./JonesUSDCIsolationModeTokenVaultV2.sol";


/**
 * @title   JonesUSDCIsolationModeTokenVaultV3
 * @author  Dolomite
 *
 * @notice  A subclass of JonesUSDCIsolationModeTokenVaultV1 which enables jUSDC farming
 */
contract JonesUSDCIsolationModeTokenVaultV3 is JonesUSDCIsolationModeTokenVaultV2 {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "JonesUSDCIsolationModeVaultV3";

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function isExternalRedemptionPaused() public override pure returns (bool) {
        // Always paused
        return true;
    }
}
