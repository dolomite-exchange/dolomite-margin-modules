// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IBerachainRewardsRegistry } from "./IBerachainRewardsRegistry.sol";


/**
 * @title   IBerachainRewardsIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of IsolationModeVaultFactory that creates vaults for Berachain rewards vault
 *          tokens, like BEX LP tokens.
 */
interface IBerachainRewardsIsolationModeVaultFactory is IIsolationModeVaultFactory {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event BerachainRewardsRegistrySet(address _berachainRewardsRegistry);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetBerachainRewardsRegistry(address _berachainRewardsRegistry) external;

    function berachainRewardsRegistry() external view returns (IBerachainRewardsRegistry);
}
