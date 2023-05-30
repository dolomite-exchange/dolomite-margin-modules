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

import { IPendlePtGLP2024Registry } from "../interfaces/IPendlePtGLP2024Registry.sol";
import { IPendlePtGLP2024WrappedTokenUserVaultFactory } from "../interfaces/IPendlePtGLP2024WrappedTokenUserVaultFactory.sol"; // solhint-disable-line max-line-length
import { WrappedTokenUserVaultFactory } from "../proxies/abstract/WrappedTokenUserVaultFactory.sol";


/**
 * @title   PendlePtGLP2024WrappedTokenUserVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the ptGLP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract PendlePtGLP2024WrappedTokenUserVaultFactory is
    IPendlePtGLP2024WrappedTokenUserVaultFactory,
    WrappedTokenUserVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtGLP2024VaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IPendlePtGLP2024Registry public override pendlePtGLP2024Registry;

    // ============ Constructor ============

    constructor(
        address _pendlePtGLP2024Registry,
        address _ptGlp, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    WrappedTokenUserVaultFactory(
        _ptGlp,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        pendlePtGLP2024Registry = IPendlePtGLP2024Registry(_pendlePtGLP2024Registry);
    }

    // ============ External Functions ============

    function ownerSetPendlePtGLP2024Registry(
        address _pendlePtGLP2024Registry
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        pendlePtGLP2024Registry = IPendlePtGLP2024Registry(_pendlePtGLP2024Registry);
        emit PendlePtGLP2024RegistrySet(_pendlePtGLP2024Registry);
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
