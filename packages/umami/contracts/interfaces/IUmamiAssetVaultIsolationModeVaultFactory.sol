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

import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultRegistry } from "./IUmamiAssetVaultRegistry.sol";



/**
 * @title   IUmamiAssetVaultIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for the factory that creates each user's vault for Umami's Delta Neutral Vault assets.
 */
interface IUmamiAssetVaultIsolationModeVaultFactory is IIsolationModeVaultFactory {

    event UmamiAssetVaultRegistrySet(address _jonesUSDCRegistry);

    function ownerSetUmamiAssetVaultRegistry(address _jonesUSDCRegistry) external;

    function umamiAssetVaultRegistry() external view returns (IUmamiAssetVaultRegistry);
}
