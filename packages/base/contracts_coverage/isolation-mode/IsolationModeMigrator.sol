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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IIsolationModeVaultFactory } from "./interfaces/IIsolationModeVaultFactory.sol";


/**
 * @title   IsolationModeMigrator
 * @author  Dolomite
 *
 * @notice  Migrator contract for admin to migrate all user funds in an iso mode vault
 */
contract IsolationModeMigrator {
    using SafeERC20 for IERC20;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "IsolationModeMigrator";

    // ================================================
    // =================== State Variables ============
    // ================================================

    IDolomiteRegistry public immutable dolomiteRegistry;
    IIsolationModeVaultFactory public immutable vaultFactory;
    // @follow-up Want to set it here or have a function that returns it?
    IERC20 public immutable MIGRATION_TOKEN;

    // ================================================
    // =================== Modifiers ==================
    // ================================================

    modifier onlyMigrator(address _from) {
        _requireOnlyMigrator(_from);
        _;
    }

    // ================================================
    // =================== Constructor ================
    // ================================================

    // @follow-up What addresses to put in here as immutable?
    constructor(address _dolomiteRegistry, address _vaultFactory, address _migrationToken) {
        dolomiteRegistry = IDolomiteRegistry(_dolomiteRegistry);
        vaultFactory = IIsolationModeVaultFactory(_vaultFactory);
        MIGRATION_TOKEN = IERC20(_migrationToken);
    }

    function migrate(uint256 _amountWei) external onlyMigrator(msg.sender) {
        MIGRATION_TOKEN.safeTransfer(
            msg.sender,
            _amountWei
        );
    }

    // ================================================
    // =================== Functions ==================
    // ================================================

    // @follow-up Is this ok to leave with no access control?
    function executeWithdrawalFromVault(address _recipient, uint256 _amount) external {}

    function _requireOnlyMigrator(address _from) internal view {
        if (_from == address(dolomiteRegistry.dolomiteMigrator())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _from == address(dolomiteRegistry.dolomiteMigrator()),
            _FILE,
            "Caller is not migrator",
            _from
        );
    }
}
