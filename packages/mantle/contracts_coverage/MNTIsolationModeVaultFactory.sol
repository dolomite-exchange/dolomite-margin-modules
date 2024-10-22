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
import { IMNTIsolationModeVaultFactory } from "./interfaces/IMNTIsolationModeVaultFactory.sol";
import { IMNTRegistry } from "./interfaces/IMNTRegistry.sol";


/**
 * @title   MNTIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GMX token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract MNTIsolationModeVaultFactory is
    IMNTIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "MNTIsolationModeVaultFactory";

    // ============ Field Variables ============

    IMNTRegistry public override mntRegistry;

    // ============ Constructor ============

    constructor(
        address _mntRegistry,
        address _mnt, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _mnt,
        _borrowPositionProxy,
        _userVaultImplementation,
        address(IMNTRegistry(_mntRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        mntRegistry = IMNTRegistry(_mntRegistry);
    }

    // ============ External Functions ============

    function setMNTRegistry(address _mntRegistry) external override onlyDolomiteMarginOwner(msg.sender) {
        mntRegistry = IMNTRegistry(_mntRegistry);
        emit MNTRegistrySet(_mntRegistry);
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
