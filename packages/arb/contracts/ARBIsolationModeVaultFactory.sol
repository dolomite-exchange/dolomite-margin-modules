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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IARBIsolationModeVaultFactory } from "./interfaces/IARBIsolationModeVaultFactory.sol";
import { IARBRegistry } from "./interfaces/IARBRegistry.sol";


/**
 * @title   ARBIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GMX token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract ARBIsolationModeVaultFactory is
    IARBIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ARBIsolationModeVaultFactory";

    // ============ Field Variables ============

    IARBRegistry public override arbRegistry;

    // ============ Constructor ============

    constructor(
        address _arbRegistry,
        address _arb, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _arb,
        _borrowPositionProxy,
        _userVaultImplementation,
        address(IARBRegistry(_arbRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        arbRegistry = IARBRegistry(_arbRegistry);
    }

    // ============ External Functions ============

    function setARBRegistry(address _arbRegistry) external override onlyDolomiteMarginOwner(msg.sender) {
        arbRegistry = IARBRegistry(_arbRegistry);
        emit ARBRegistrySet(_arbRegistry);
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
