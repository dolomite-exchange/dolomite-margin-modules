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

import {IPendleYtGLP2024IsolationModeVaultFactory} from "../interfaces/pendle/IPendleYtGLP2024IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import {IPendleGLPRegistry} from "../interfaces/pendle/IPendleGLPRegistry.sol";
import {IsolationModeVaultFactory} from "../proxies/abstract/IsolationModeVaultFactory.sol";
import {IPendleYtToken} from "../interfaces/pendle/IPendleYtToken.sol";

/**
 * @title   PendleYtGLP2024IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the ytGLP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
// @follow-up Vault YT maturity date
contract PendleYtGLP2024IsolationModeVaultFactory is
    IPendleYtGLP2024IsolationModeVaultFactory,
    IsolationModeVaultFactory
    // @note extend from simpleIsolationModeVaultFactory
{
    // @follow-up Require statement for collateral market
    // ============ Constants ============

    bytes32 private constant _FILE = "PendleYtGLP2024VaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    IPendleGLPRegistry public override pendleGLPRegistry;
    uint256 public override ytMaturityDate;

    // ============ Constructor ============

    constructor(
        address _pendleGLPRegistry,
        address _ytGlp, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
        IsolationModeVaultFactory(
            _ytGlp,
            _borrowPositionProxy,
            _userVaultImplementation,
            _dolomiteMargin
        )
    {
        pendleGLPRegistry = IPendleGLPRegistry(_pendleGLPRegistry);
        ytMaturityDate = IPendleYtToken(UNDERLYING_TOKEN).expiry();
    }

    // ============ External Functions ============

    function ownerSetPendleGLPRegistry(
        address _pendleGLPRegistry
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        pendleGLPRegistry = IPendleGLPRegistry(_pendleGLPRegistry);
        emit PendleGLPRegistrySet(_pendleGLPRegistry);
    }

    function ownerSetYtMaturityDate(
        uint256 _ytMaturityDate
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        ytMaturityDate = _ytMaturityDate;
        emit YtMaturityDateSet(_ytMaturityDate);
    }

    function allowableDebtMarketIds() external pure returns (uint256[] memory) {
        // allow all markets
        return new uint256[](0);
    }

    function allowableCollateralMarketIds()
        external
        pure
        returns (uint256[] memory)
    {
        // allow all markets
        return new uint256[](0);
    }
}