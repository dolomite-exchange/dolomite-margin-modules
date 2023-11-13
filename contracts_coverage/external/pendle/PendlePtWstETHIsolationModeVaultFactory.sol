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

import { IPendleWstETHRegistry } from "../interfaces/pendle/IPendleWstETHRegistry.sol";
import { IPendlePtWstETHIsolationModeVaultFactory } from "../interfaces/pendle/IPendlePtWstETHIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IsolationModeVaultFactory } from "../proxies/abstract/IsolationModeVaultFactory.sol";


/**
 * @title   PendlePtGLP2024IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the ptWstETH token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract PendlePtWstETHIsolationModeVaultFactory is
    IPendlePtWstETHIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtWstETHVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IPendleWstETHRegistry public override pendleWstETHRegistry;

    // ============ Constructor ============

    constructor(
        address _pendleWstETHRegistry,
        address _ptWstEth, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _ptWstEth,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        pendleWstETHRegistry = IPendleWstETHRegistry(_pendleWstETHRegistry);
    }

    // ============ External Functions ============

    function ownerSetPendleWstETHRegistry(
        address _pendleWstETHRegistry
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        pendleWstETHRegistry = IPendleWstETHRegistry(_pendleWstETHRegistry);
        emit PendleWstETHRegistrySet(_pendleWstETHRegistry);
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
