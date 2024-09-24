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

import { GMXIsolationModeTokenVaultV1 } from "../GMXIsolationModeTokenVaultV1.sol";


/**
 * @title   TestGMXIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract TestGMXIsolationModeTokenVaultV1 is GMXIsolationModeTokenVaultV1 {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "TestGMXIsolationModeTokenVaultV1";
    bytes32 private constant _TRANSFER_REQUESTED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.transferRequested")) - 1); // solhint-disable-line max-line-length

    // ==================================================================
    // =========================== Functions ============================
    // ==================================================================

    function transferRequested() external view returns (bool) {
        return _getUint256(_TRANSFER_REQUESTED_SLOT) == 1;
    }
}
