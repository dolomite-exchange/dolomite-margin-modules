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

import { IsolationModeMigrator } from "@dolomite-exchange/modules-base/contracts/isolation-mode/IsolationModeMigrator.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IJonesRouter } from "./interfaces/IJonesRouter.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";

import "hardhat/console.sol";

/**
 * @title   JonesIsolationModeMigrator
 * @author  Dolomite
 *
 * @notice  Migrator contract for Jones USDC
 */
contract JonesIsolationModeMigrator is IsolationModeMigrator {
    using SafeERC20 for IERC20;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "JonesIsolationModeMigrator";
    uint256 private constant _JUSDC_POOL_ID = 1;

    // ================================================
    // =================== State Variables ============
    // ================================================

    IJonesUSDCRegistry public immutable jUsdcRegistry;
    bool public migrationInitialized;

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(address _jUsdcRegistry, address _dolomiteRegistry, address _vaultFactory, address _migrationToken)
        IsolationModeMigrator(_dolomiteRegistry, _vaultFactory, _migrationToken) {
        jUsdcRegistry = IJonesUSDCRegistry(_jUsdcRegistry);
    }

    function _migrate(uint256 _amountWei) internal override {
        if (!migrationInitialized) {
            migrationInitialized = true;

            uint256 stakedAmount = jUsdcRegistry.jUSDCFarm().userInfo(_JUSDC_POOL_ID, address(this)).amount;
            if (stakedAmount > 0) {
                jUsdcRegistry.jUSDCFarm().withdraw(_JUSDC_POOL_ID, stakedAmount, address(this));
            }
        }

        super._migrate(_amountWei);
    }
}
