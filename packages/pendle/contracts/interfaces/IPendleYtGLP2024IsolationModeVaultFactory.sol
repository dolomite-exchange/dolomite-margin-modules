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

import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IPendleGLPRegistry } from "./IPendleGLPRegistry.sol";

/**
 * @title   IPendleYtGLP2024IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of IsolationModeVaultFactory that creates vaults for ytGLP tokens.
 */
interface IPendleYtGLP2024IsolationModeVaultFactory is IIsolationModeVaultFactory {
    // ================================================
    // ==================== Events ====================
    // ================================================

    event PendleGLPRegistrySet(address _pendleGLPRegistry);
    event YtMaturityTimestampSet(uint256 _ytMaturityTimestamp);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetPendleGLPRegistry(address _pendleGLPRegistry) external;

    function ownerSetYtMaturityTimestamp(uint256 _ytMaturityTimstamp) external;

    function WETH() external view returns (address);

    function WETH_MARKET_ID() external view returns (uint256);

    function pendleGLPRegistry() external view returns (IPendleGLPRegistry);

    function ytMaturityTimestamp() external view returns (uint256);
}
