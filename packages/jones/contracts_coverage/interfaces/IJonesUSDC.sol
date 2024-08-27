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

import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";


/**
 * @title   IJonesUSDC
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Jones DAO's jUSDC V2 contract
 *          (0xB0BDE111812EAC913b392D80D51966eC977bE3A2)
 */
interface IJonesUSDC is IERC4626 {

    // ==================================================================
    // ========================== Functions =============================
    // ==================================================================

    function initialize(
        address _asset,
        address _enforceHub,
        string calldata _name,
        string calldata _symbol
    ) external;

    function addOperator(address _newOperator) external;
}
