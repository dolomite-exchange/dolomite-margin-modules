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

import { IsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredBGTIsolationModeVaultFactory } from "./interfaces/IInfraredBGTIsolationModeVaultFactory.sol";


/**
 * @title   InfraredBGTIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the iBGT token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract InfraredBGTIsolationModeVaultFactory is
    IsolationModeVaultFactory,
    IInfraredBGTIsolationModeVaultFactory
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "InfraredBGTIsolationVaultFactory";

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

    // @audit @Corey please double check these permissions and confirm only the proper metaVault can call
    function depositIntoDolomiteMarginFromMetaVault(
        address _owner,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external {
        address vault = _userToVaultMap[_owner];
        assert(vault != address(0));

        Require.that(
            berachainRewardsRegistry.getVaultToMetaVault(vault) == msg.sender,
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
        berachainRewardsRegistry = IBerachainRewardsRegistry(_berachainRewardsRegistry);
        emit BerachainRewardsRegistrySet(_berachainRewardsRegistry);
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
