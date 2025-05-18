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

import { MinimalERC20 } from "@dolomite-exchange/modules-base/contracts/general/MinimalERC20.sol";
import { SimpleIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/SimpleIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IPOLIsolationModeVaultFactory } from "./interfaces/IPOLIsolationModeVaultFactory.sol";


/**
 * @title   POLIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around a PoL-enabled dolomite token that empowers users to deposit the underlying
 *          collateral into PoL from Dolomite while they borrow against their assets.
 */
contract POLIsolationModeVaultFactory is
    IPOLIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "POLIsolationModeVaultFactory";

    // ============ Field Variables ============

    IBerachainRewardsRegistry public override berachainRewardsRegistry;

    // ============ Constructor ============

    constructor(
        string memory _name,
        string memory _symbol,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _berachainRewardsRegistry,
        address _underlyingToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    SimpleIsolationModeVaultFactory(
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _underlyingToken,
        _borrowPositionProxy,
        _userVaultImplementation,
        address(IBerachainRewardsRegistry(_berachainRewardsRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        berachainRewardsRegistry = IBerachainRewardsRegistry(_berachainRewardsRegistry);
        _initializeTokenInfo(_name, _symbol, MinimalERC20(_underlyingToken).decimals());
    }

    // ============ External Functions ============

    function ownerSetBerachainRewardsRegistry(
        address _berachainRewardsRegistry
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        berachainRewardsRegistry = IBerachainRewardsRegistry(_berachainRewardsRegistry);
        emit BerachainRewardsRegistrySet(_berachainRewardsRegistry);
    }

    function ownerSetUserVaultImplementation(
        address /* _userVaultImplementation */

    )
        external override(IIsolationModeVaultFactory, IsolationModeVaultFactory)
        view
        onlyDolomiteMarginOwner(msg.sender)
    {
        revert("POLIsolationModeVaultFactory: Not implemented");
    }

    function userVaultImplementation()
        public override(IIsolationModeVaultFactory, IsolationModeVaultFactory)
        view
        returns (address)
    {
        return berachainRewardsRegistry.polTokenVault();
    }

    // ============ Internal Functions ============

    function _createVault(address _account) internal override returns (address) {
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
