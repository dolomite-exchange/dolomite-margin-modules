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
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGMXIsolationModeTokenVaultV1 } from "./interfaces/IGMXIsolationModeTokenVaultV1.sol";
import { IGMXIsolationModeVaultFactory } from "./interfaces/IGMXIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";


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
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GMXIsolationModeVaultFactory";

    // ============ Field Variables ============

    IGmxRegistryV1 public override gmxRegistry;

    // ============ Modifiers ============

    modifier onlyGLPVault(address _glpVault, address _vault) {
        Require.that(
            gmxRegistry.glpVaultFactory().getAccountByVault(_glpVault) == _vaultToUserMap[_vault],
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
        address(IGmxRegistryV1(_gmxRegistry).dolomiteRegistry()),
        _dolomiteMargin
    ) {
        gmxRegistry = IGmxRegistryV1(_gmxRegistry);
    }

    // ============ External Functions ============

    function executeDepositIntoVaultFromGLPVault(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei,
        bool _shouldSkipTransfer
    ) external onlyGLPVault(msg.sender, _vault) {
        if (_amountWei == 0) {
            // Guard statement. If the amount is 0, setShouldSkipTransfer is not unset, otherwise
            return;
        }

        if (_shouldSkipTransfer) {
            IGMXIsolationModeTokenVaultV1(_vault).setShouldSkipTransfer(true);
        } else {
            IGMXIsolationModeTokenVaultV1(_vault).setIsDepositSourceGLPVault(true);
        }

        _enqueueTransfer(
            /* from = */ _vault,
            /* to = */ address(DOLOMITE_MARGIN()),
            /* amount = */ _amountWei,
            /* vault = */_vault
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
        address vault = super._createVault(_account);

        if (_account != _DEAD_VAULT) {
            address glpVault = gmxRegistry.glpVaultFactory().getVaultByAccount(_account);
            if (glpVault == address(0)) {
                glpVault = gmxRegistry.glpVaultFactory().createVault(_account);
            }
            IGLPIsolationModeTokenVaultV2(glpVault).sync(vault);
        }

        return vault;
    }
}
