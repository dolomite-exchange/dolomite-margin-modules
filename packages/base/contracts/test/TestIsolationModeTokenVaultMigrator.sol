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

import { IsolationModeTokenVaultMigrator } from "../isolation-mode/IsolationModeTokenVaultMigrator.sol";


/**
 * @title   TestIsolationModeTokenVaultMigrator
 * @author  Dolomite
 *
 * @notice  Test migrator contract that lets the tester set the vault factory slot
 */
contract TestIsolationModeTokenVaultMigrator is IsolationModeTokenVaultMigrator {

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(
        address _dolomiteRegistry,
        address _migrationToken,
        address _vaultFactory
    )
        IsolationModeTokenVaultMigrator(_dolomiteRegistry, _migrationToken)
    {
        _setAddress(_VAULT_FACTORY_SLOT, _vaultFactory);
    }
}
