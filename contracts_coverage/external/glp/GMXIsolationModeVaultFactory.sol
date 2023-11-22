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

import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { IsolationModeUpgradeableProxy } from "../proxies/IsolationModeUpgradeableProxy.sol";
import { IIsolationModeUpgradeableProxy } from "../interfaces/IIsolationModeUpgradeableProxy.sol";
import { IGMXIsolationModeTokenVaultV1 } from "../interfaces/gmx/IGMXIsolationModeTokenVaultV1.sol";
import { IGLPIsolationModeTokenVaultV2 } from "../interfaces/gmx/IGLPIsolationModeTokenVaultV2.sol";
import { IGMXIsolationModeVaultFactory } from "../interfaces/gmx/IGMXIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "../interfaces/gmx/IGmxRegistryV1.sol";
import { IsolationModeVaultFactory } from "../proxies/abstract/IsolationModeVaultFactory.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGLPIsolationModeVaultFactory } from "../interfaces/gmx/IGLPIsolationModeVaultFactory.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   GMXIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the GMX token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract GMXIsolationModeVaultFactory is
    IGMXIsolationModeVaultFactory,
    IsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "GMXIsolationModeVaultFactory";

    // ============ Field Variables ============

    IGmxRegistryV1 public override gmxRegistry;

    // ============ Modifiers ============

    modifier onlyGLPVault(address _glpVault, address _vault) {
        if (_vaultToUserMap[_vault] == gmxRegistry.glpVaultFactory().getAccountByVault(_glpVault)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _vaultToUserMap[_vault] == gmxRegistry.glpVaultFactory().getAccountByVault(_glpVault),
            _FILE,
            "Invalid GLP vault"
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        address _gmxRegistry,
        address _gmx, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    IsolationModeVaultFactory(
        _gmx,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        gmxRegistry = IGmxRegistryV1(_gmxRegistry);
    }

    // ============ External Functions ============

    function executeDepositIntoVaultFromGLPVault(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    ) external onlyGLPVault(msg.sender, _vault) {
        // @follow-up Should this be flag instead?
        IGMXIsolationModeTokenVaultV1(_vault).setShouldSkipTransfer(true);
        _enqueueTransfer(
            _vault,
            address(DOLOMITE_MARGIN()),
            _amountWei,
            _vault
        );
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            /* _accountOwner = */ _vault,
            /* _fromAccount = */ _vault,
            _vaultAccountNumber,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            })
        );
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

    // ============ Overrides ============

    function _createVault(address _account) internal override returns (address) {
        if (_account != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _account != address(0),
            _FILE,
            "Invalid account"
        );
        if (_userToVaultMap[_account] == address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _userToVaultMap[_account] == address(0),
            _FILE,
            "Vault already exists"
        );
        address vault = Create2.deploy(
            /* amount = */ 0,
            keccak256(abi.encodePacked(_account)),
            type(IsolationModeUpgradeableProxy).creationCode
        );
        /*assert(vault != address(0));*/
        emit VaultCreated(_account, vault);
        _vaultToUserMap[vault] = _account;
        _userToVaultMap[_account] = vault;
        IIsolationModeUpgradeableProxy(vault).initialize(_account);
        BORROW_POSITION_PROXY.setIsCallerAuthorized(vault, true);

        address glpVault = gmxRegistry.glpVaultFactory().getVaultByAccount(_account);
        if (glpVault != address(0)) {
            IGLPIsolationModeTokenVaultV2(glpVault).sync(vault);
        }

        return vault;
    }
}
