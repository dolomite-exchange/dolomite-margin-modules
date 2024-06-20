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
import { IGLPIsolationModeTokenVaultV1 } from "./interfaces/IGLPIsolationModeTokenVaultV1.sol";
import { IGLPIsolationModeVaultFactory } from "./interfaces/IGLPIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";


/**
 * @title   GLPIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the fsGLP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract GLPIsolationModeVaultFactory is
    IGLPIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "GLPIsolationModeVaultFactory";

    // ============ Field Variables ============

    address public immutable override WETH; // solhint-disable-line var-name-mixedcase
    uint256 public immutable override WETH_MARKET_ID; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public override gmxRegistry;

    // ============ Constructor ============

    constructor(
        address _weth,
        uint256 _wethMarketId,
        address _gmxRegistry,
        address _fsGlp, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _fsGlp,
        _borrowPositionProxy,
        _userVaultImplementation,
        address(IGmxRegistryV1(_gmxRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        WETH = _weth;
        WETH_MARKET_ID = _wethMarketId;
        gmxRegistry = IGmxRegistryV1(_gmxRegistry);
    }

    // ============ External Functions ============

    function createVaultAndAcceptFullAccountTransfer(
        address _sender
    )
    external
    override
    requireIsInitialized
    returns (address) {
        address vault = _createVault(msg.sender);
        IGLPIsolationModeTokenVaultV1(vault).acceptFullAccountTransfer(_sender);
        return vault;
    }

    function setGmxRegistry(address _gmxRegistry) external override onlyDolomiteMarginOwner(msg.sender) {
        gmxRegistry = IGmxRegistryV1(_gmxRegistry);
        emit GmxRegistrySet(_gmxRegistry);
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
