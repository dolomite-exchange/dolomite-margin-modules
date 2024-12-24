// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { SimpleIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/SimpleIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IMetaVaultRewardTokenFactory } from "./interfaces/IMetaVaultRewardTokenFactory.sol";


/**
 * @title   MetaVaultRewardTokenFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the a PoL reward token (like BGT) that is used to create user vaults and manage the entry
 *          points that a user can use to interact with DolomiteMargin from the vault.
 */
abstract contract MetaVaultRewardTokenFactory is
    IMetaVaultRewardTokenFactory,
    SimpleIsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "MetaVaultRewardReceiverFactory";

    // ============ Field Variables ============

    IBerachainRewardsRegistry public override berachainRewardsRegistry;

    // ============ Constructor ============

    constructor(
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
        _ownerSetBerachainRewardsRegistry(_berachainRewardsRegistry);
    }

    // ============ External Functions ============

    function depositIntoDolomiteMarginFromMetaVault(
        address _owner,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external {
        address vault = _userToVaultMap[_owner];
        if (vault == address(0)) {
            vault = _createVault(_owner);
        }

        Require.that(
            berachainRewardsRegistry.getMetaVaultByVault(vault) == msg.sender,
            _FILE,
            "Can only deposit from metaVault"
        );

        _enqueueTransfer(
            vault,
            address(DOLOMITE_MARGIN()),
            _amountWei,
            vault
        );
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            /* _accountOwner = */ vault,
            /* _fromAccount = */ vault,
            _toAccountNumber,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            })
        );
    }

    function ownerSetBerachainRewardsRegistry(
        address _berachainRewardsRegistry
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBerachainRewardsRegistry(_berachainRewardsRegistry);
    }

    // ============ Internal Functions ============

    function _ownerSetBerachainRewardsRegistry(
        address _berachainRewardsRegistry
    ) internal {
        berachainRewardsRegistry = IBerachainRewardsRegistry(_berachainRewardsRegistry);
        emit BerachainRewardsRegistrySet(_berachainRewardsRegistry);
    }

    function _createVault(address _account) internal override returns (address) {
        address vault = super._createVault(_account);

        if (_account != _DEAD_VAULT) {
            // When initializing the _DEAD_ACCOUNT, the factory isn't set up yet as a global operator/listed market
            berachainRewardsRegistry.createMetaVault(_account, vault);
        }

        return vault;
    }
}
