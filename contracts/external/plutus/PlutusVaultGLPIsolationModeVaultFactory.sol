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

import { IPlutusVaultGLPIsolationModeVaultFactory } from "../interfaces/IPlutusVaultGLPIsolationModeVaultFactory.sol";
import { IPlutusVaultRegistry } from "../interfaces/IPlutusVaultRegistry.sol";
import { IsolationModeVaultFactory } from "../proxies/abstract/IsolationModeVaultFactory.sol";


/**
 * @title   PlutusVaultGLPIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the plvGLP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract PlutusVaultGLPIsolationModeVaultFactory is
    IPlutusVaultGLPIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "PlutusVaultGLPVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IPlutusVaultRegistry public override plutusVaultRegistry;

    // ============ Constructor ============

    constructor(
        address _plutusVaultRegistry,
        address _plvGlp, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _plvGlp,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        plutusVaultRegistry = IPlutusVaultRegistry(_plutusVaultRegistry);
    }

    // ============ External Functions ============

    function ownerSetPlutusVaultRegistry(
        address _plutusVaultRegistry
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        plutusVaultRegistry = IPlutusVaultRegistry(_plutusVaultRegistry);
        emit PlutusVaultRegistrySet(_plutusVaultRegistry);
    }

    function allowableDebtMarketIds() external pure returns (uint256[] memory) {
        // allow all markets
        return new uint256[](0);
    }

    function allowableCollateralMarketIds() external pure returns (uint256[] memory) {
        // allow all markets
        return new uint256[](0);
    }
}
