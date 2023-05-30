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

import { IPendlePtGLP2024Registry } from "./IPendlePtGLP2024Registry.sol";
import { IWrappedTokenUserVaultFactory } from "./IWrappedTokenUserVaultFactory.sol";


/**
 * @title   IPendlePtGLP2024WrappedTokenUserVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of WrappedTokenUserVaultFactory that creates vaults for ptGLP tokens.
 */
interface IPendlePtGLP2024WrappedTokenUserVaultFactory is IWrappedTokenUserVaultFactory {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event PendlePtGLP2024RegistrySet(address _pendlePtGLP2024Registry);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetPendlePtGLP2024Registry(address _pendlePtGLP2024Registry) external;

    function pendlePtGLP2024Registry() external view returns (IPendlePtGLP2024Registry);
}
