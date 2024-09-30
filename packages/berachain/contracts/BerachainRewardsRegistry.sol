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

import { BaseRegistry } from "@dolomite-exchange/modules-base/contracts/general/BaseRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IBeraRewardVault } from "./interfaces/IBeraRewardVault.sol";



/**
 * @title   BerachainRewardsRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the BerachainRewards-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Arbitrum introduces.
 */
contract BerachainRewardsRegistry is IBerachainRewardsRegistry, BaseRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "BerachainRewardsRegistry";
    bytes32 private constant _REWARD_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.rewardVault")) - 1);

    // ==================== Initializer ====================

    function initialize(address _rewardVault, address _dolomiteRegistry) external initializer {
        _ownerSetRewardVault(_rewardVault);
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    function ownerSetRewardVault(address _rewardVault) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRewardVault(_rewardVault);
    }

    function rewardVault() external view override returns (IBeraRewardVault) {
        return IBeraRewardVault(_getAddress(_REWARD_VAULT_SLOT));
    }

    function _ownerSetRewardVault(address _rewardVault) internal {
        Require.that(
            _rewardVault != address(0),
            _FILE,
            "Invalid rewardVault address"
        );
        _setAddress(_REWARD_VAULT_SLOT, _rewardVault);
        emit RewardVaultSet(_rewardVault);
    }

}
