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

import { IUmamiAssetVaultIsolationModeVaultFactory } from "../interfaces/umami/IUmamiAssetVaultIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IUmamiAssetVaultRegistry } from "../interfaces/umami/IUmamiAssetVaultRegistry.sol";
import { SimpleIsolationModeVaultFactory } from "../proxies/SimpleIsolationModeVaultFactory.sol";


/**
 * @title   UmamiAssetVaultIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the plvGLP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract UmamiAssetVaultIsolationModeVaultFactory is
    IUmamiAssetVaultIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "UmamiAssetVaultVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IUmamiAssetVaultRegistry public override umamiAssetVaultRegistry;

    // ============ Constructor ============

    constructor(
        address _umamiAssetVaultRegistry,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _umamiAssetVaultToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    SimpleIsolationModeVaultFactory(
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _umamiAssetVaultToken,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        umamiAssetVaultRegistry = IUmamiAssetVaultRegistry(_umamiAssetVaultRegistry);
    }

    // ============ External Functions ============

    function ownerSetUmamiAssetVaultRegistry(
        address _umamiAssetVaultRegistry
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        umamiAssetVaultRegistry = IUmamiAssetVaultRegistry(_umamiAssetVaultRegistry);
        emit UmamiAssetVaultRegistrySet(_umamiAssetVaultRegistry);
    }

    // ============ Internal Functions ============

    function _afterInitialize() internal override {
        uint256[] memory allowableMarkets = new uint256[](1);
        allowableMarkets[0] = marketId;
        _ownerSetAllowableCollateralMarketIds(allowableMarkets);
    }
}
