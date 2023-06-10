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

import { IJonesUSDCRegistry } from "./IJonesUSDCRegistry.sol";
import { IIsolationModeTokenVaultV1 } from "../IIsolationModeTokenVaultV1.sol";



/**
 * @title   IJonesUSDCIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Interface for the user vault implementation that holds each user's jUSDC isolation mode.
 */
interface IJonesUSDCIsolationModeTokenVaultV1 is IIsolationModeTokenVaultV1 {

    function registry() external view returns (IJonesUSDCRegistry);
}
