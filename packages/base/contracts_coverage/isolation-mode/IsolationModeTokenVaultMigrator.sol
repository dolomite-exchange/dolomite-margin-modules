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
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IIsolationModeTokenVaultMigrator } from "./interfaces/IIsolationModeTokenVaultMigrator.sol";


/**
 * @title   IsolationModeTokenVaultMigrator
 * @author  Dolomite
 *
 * @notice  Migrator contract for admin to migrate all user funds in an iso mode vault
 */
contract IsolationModeTokenVaultMigrator is IIsolationModeTokenVaultMigrator, ProxyContractHelpers {
    using SafeERC20 for IERC20;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "IsolationModeTokenVaultMigrator";
    bytes32 internal constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);

    // ================================================
    // =================== State Variables ============
    // ================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;
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

    constructor(address _dolomiteRegistry, address _migrationToken) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        MIGRATION_TOKEN = IERC20(_migrationToken);
    }

    function migrate(uint256 _amountWei) external onlyMigrator(msg.sender) {
        _migrate(_amountWei);
    }

    function executeWithdrawalFromVault(address /* _recipient */, uint256 /* _amount */) external {
        if (msg.sender == VAULT_FACTORY()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender == VAULT_FACTORY(),
            _FILE,
            "Only factory can call"
        );
    }

    function VAULT_FACTORY() public view returns (address) {
        return _getAddress(_VAULT_FACTORY_SLOT);
    }

    function _migrate(uint256 _amountWei) internal virtual {
        MIGRATION_TOKEN.safeTransfer(
            msg.sender,
            _amountWei
        );
    }

    function _requireOnlyMigrator(address _from) internal view {
        if (_from == address(DOLOMITE_REGISTRY.dolomiteMigrator())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _from == address(DOLOMITE_REGISTRY.dolomiteMigrator()),
            _FILE,
            "Caller is not migrator",
            _from
        );
    }
}
