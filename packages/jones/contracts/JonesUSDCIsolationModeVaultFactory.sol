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

import { SimpleIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/SimpleIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IJonesUSDCIsolationModeVaultFactory } from "./interfaces/IJonesUSDCIsolationModeVaultFactory.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";


/**
 * @title   JonesUSDCIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the plvGLP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract JonesUSDCIsolationModeVaultFactory is
    IJonesUSDCIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "JonesUSDCVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IJonesUSDCRegistry public override jonesUSDCRegistry;

    // ============ Constructor ============

    constructor(
        address _jonesUSDCRegistry,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _jUSDC, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    SimpleIsolationModeVaultFactory(
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _jUSDC,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        jonesUSDCRegistry = IJonesUSDCRegistry(_jonesUSDCRegistry);
    }

    // ============ External Functions ============

    function ownerSetJonesUSDCRegistry(
        address _jonesUSDCRegistry
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        jonesUSDCRegistry = IJonesUSDCRegistry(_jonesUSDCRegistry);
        emit JonesUSDCRegistrySet(_jonesUSDCRegistry);
    }
}
