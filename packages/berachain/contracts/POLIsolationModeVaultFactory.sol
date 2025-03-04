// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IPOLIsolationModeVaultFactory } from "./interfaces/IPOLIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length


/**
 * @title   POLIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around a PoL-enabled dolomite token that empowers users to deposit the underlying
 *          collateral into PoL from Dolomite while they borrow against their assets.
 */
contract POLIsolationModeVaultFactory is
    IPOLIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "POLIsolationModeVaultFactory";

    // ============ Field Variables ============

    IBerachainRewardsRegistry public override berachainRewardsRegistry;

    // ============ Constructor ============

    constructor(
        address _berachainRewardsRegistry,
        address _underlyingToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _underlyingToken,
        _borrowPositionProxy,
        _userVaultImplementation,
        address(IBerachainRewardsRegistry(_berachainRewardsRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        berachainRewardsRegistry = IBerachainRewardsRegistry(_berachainRewardsRegistry);
    }

    // ============ External Functions ============

    function ownerSetBerachainRewardsRegistry(
        address _berachainRewardsRegistry
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        berachainRewardsRegistry = IBerachainRewardsRegistry(_berachainRewardsRegistry);
        emit BerachainRewardsRegistrySet(_berachainRewardsRegistry);
    }

    function allowableDebtMarketIds() external pure returns (uint256[] memory) {
        // allow all markets
        // @todo extend from simple just in case so we can change this
        return new uint256[](0);
    }

    function allowableCollateralMarketIds() external pure returns (uint256[] memory) {
        // allow all markets
        return new uint256[](0);
    }

    // ============ Internal Functions ============

    function _createVault(address _account) internal virtual override returns (address) {
        address vault = super._createVault(_account);

        if (_account != _DEAD_VAULT) {
            bool doesMetaVaultAlreadyExist = berachainRewardsRegistry.getMetaVaultByAccount(_account) != address(0);
            address metaVault = berachainRewardsRegistry.createMetaVault(_account, vault);
            if (!doesMetaVaultAlreadyExist) {
                // This is emitted for the subgraph
                emit VaultCreated(_account, metaVault);
            }
        }
        return vault;
    }
}
