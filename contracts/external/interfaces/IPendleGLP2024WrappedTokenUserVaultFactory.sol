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

import { IPendleGLP2024Registry } from "./IPendleGLP2024Registry.sol";
import { IWrappedTokenUserVaultFactory } from "./IWrappedTokenUserVaultFactory.sol";


/**
 * @title   IPendleGLP2024WrappedTokenUserVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of WrappedTokenUserVaultFactory that creates vaults for ptGLP tokens.
 */
interface IPendleGLP2024WrappedTokenUserVaultFactory is IWrappedTokenUserVaultFactory {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event PendleGLP2024RegistrySet(address _pendleGLP2024Registry);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetPendleGLP2024Registry(address _pendleGLP2024Registry) external;

    function pendleGLP2024Registry() external view returns (IPendleGLP2024Registry);
}
