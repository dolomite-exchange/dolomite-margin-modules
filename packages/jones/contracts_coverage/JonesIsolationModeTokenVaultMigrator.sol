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

import { IsolationModeTokenVaultMigrator } from "@dolomite-exchange/modules-base/contracts/isolation-mode/IsolationModeTokenVaultMigrator.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";


/**
 * @title   JonesIsolationModeMigrator
 * @author  Dolomite
 *
 * @notice  Migrator contract for Jones USDC
 */
contract JonesIsolationModeTokenVaultMigrator is IsolationModeTokenVaultMigrator {
    using SafeERC20 for IERC20;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "JonesIsolationModeMigrator";
    uint256 private constant _JUSDC_POOL_ID = 1;
    bytes32 private constant _IS_MIGRATION_INITIALIZED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isMigrationInitialized")) - 1); // solhint-disable-line max-line-length

    // ================================================
    // =================== State Variables ============
    // ================================================

    IJonesUSDCRegistry public immutable JONES_USDC_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(
        address _jonesUsdcRegistry,
        address _dolomiteRegistry,
        address _migrationToken
    )
        IsolationModeTokenVaultMigrator(_dolomiteRegistry, _migrationToken)
    {
        JONES_USDC_REGISTRY = IJonesUSDCRegistry(_jonesUsdcRegistry);
    }

    function isMigrationInitialized() public view returns (bool) {
        return _getUint256(_IS_MIGRATION_INITIALIZED_SLOT) == 1;
    }

    function _migrate(uint256 _amountWei) internal override {
        if (!isMigrationInitialized()) {
            _setUint256(_IS_MIGRATION_INITIALIZED_SLOT, 1);

            uint256 stakedAmount = JONES_USDC_REGISTRY.jUSDCFarm().userInfo(_JUSDC_POOL_ID, address(this)).amount;
            if (stakedAmount > 0) {
                JONES_USDC_REGISTRY.jUSDCFarm().withdraw(_JUSDC_POOL_ID, stakedAmount, address(this));
            }
        }

        super._migrate(_amountWei);
    }
}
