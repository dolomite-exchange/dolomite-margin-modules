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
import { IGammaIsolationModeVaultFactory } from "./interfaces/IGammaIsolationModeVaultFactory.sol";
import { IGammaRegistry } from "./interfaces/IGammaRegistry.sol";


/**
 * @title   GammaIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around a Gamma LP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract GammaIsolationModeVaultFactory is
    IGammaIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ARBIsolationModeVaultFactory";

    // ============ Field Variables ============

    IGammaRegistry public override gammaRegistry;

    // ============ Constructor ============

    constructor(
        address _gammaRegistry,
        address _gammaPool, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _gammaPool,
        _borrowPositionProxy,
        _userVaultImplementation,
        address(IGammaRegistry(_gammaRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        gammaRegistry = IGammaRegistry(_gammaRegistry);
    }

    // ============ External Functions ============

    function setGammaRegistry(address _gammaRegistry) external override onlyDolomiteMarginOwner(msg.sender) {
        gammaRegistry = IGammaRegistry(_gammaRegistry);
        emit GammaRegistrySet(_gammaRegistry);
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
