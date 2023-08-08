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

import { IsolationModeTokenVaultV1WithPausable } from "./IsolationModeTokenVaultV1WithPausable.sol";
import { Require } from "../../../protocol/lib/Require.sol";


/**
 * @title   IsolationModeTokenVaultV1WithPausableAndOnlyEoa
 * @author  Dolomite
 *
 * @notice  An abstract implementation of IsolationModeTokenVaultV1 that disallows borrows if the ecosystem integration
 *          is paused.
 */
abstract contract IsolationModeTokenVaultV1WithPausableAndOnlyEoa is IsolationModeTokenVaultV1WithPausable {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeVaultV1Pausable&Eoa"; // shortened to fit in 32 bytes

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function _requireOnlyVaultOwner(address _from) internal override view {
        super._requireOnlyVaultOwner(_from);
        // solhint-disable avoid-tx-origin
        Require.that(
            _from == tx.origin,
            _FILE,
            "Only EOA can call",
            _from
        );
        // solhint-enable avoid-tx-origin
    }

    function _requireOnlyVaultOwnerOrVaultFactory(address _from) internal override view {
        super._requireOnlyVaultOwnerOrVaultFactory(_from);
        // solhint-disable avoid-tx-origin
        Require.that(
            _proxySelf().owner() == tx.origin,
            _FILE,
            "Vault owner is not an EOA",
            _proxySelf().owner()
        );
        // solhint-enable avoid-tx-origin
    }
}
