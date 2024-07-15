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

import { IsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IUSDCIsolationModeVaultFactory } from "./interfaces/IUSDCIsolationModeVaultFactory.sol";
import { IUSDCRegistry } from "./interfaces/IUSDCRegistry.sol";


/**
 * @title   USDCIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the PT token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract USDCIsolationModeVaultFactory is
    IUSDCIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "USDCVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IUSDCRegistry public override usdcRegistry;

    // ============ Constructor ============

    constructor(
        address _usdcRegistry,
        address _usdc, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _usdc,
        _borrowPositionProxy,
        _userVaultImplementation,
        address(IUSDCRegistry(_usdcRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        usdcRegistry = IUSDCRegistry(_usdcRegistry);
    }

    // ============ External Functions ============

    function ownerSetUSDCRegistry(
        address _usdcRegistry
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        usdcRegistry = IUSDCRegistry(_usdcRegistry);
        emit USDCRegistrySet(_usdcRegistry);
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
