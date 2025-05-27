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

import { IBaseMetaVault } from "./interfaces/IBaseMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredVault } from "./interfaces/IInfraredVault.sol";


/**
 * @title   BerachainRewardsReader
 * @author  Dolomite
 *
 * @notice  Used by the frontend to simplify reading rewards and limit network calls
 */
contract BerachainRewardsReader {

    IBerachainRewardsRegistry public immutable REGISTRY;

    constructor(address _registry) {
        REGISTRY = IBerachainRewardsRegistry(_registry);
    }

    function getPendingRewardsByUserAndAsset(
        address _account,
        address _asset
    ) external view returns (IInfraredVault.UserReward[] memory) {
        address metaVault = REGISTRY.getMetaVaultByAccount(_account);
        if (metaVault == address(0)) {
            return new IInfraredVault.UserReward[](0);
        }

        return IBaseMetaVault(metaVault).getPendingRewardsByAsset(_asset);
    }

    function getStakedBalanceOf(
        address _account,
        address _asset
    ) external view returns (uint256) {
        IBaseMetaVault metaVault = IBaseMetaVault(REGISTRY.getMetaVaultByAccount(_account));
        if (address(metaVault) == address(0)) {
            return 0;
        }

        if (_asset == address(REGISTRY.iBgt())) {
            return REGISTRY.iBgtStakingVault().balanceOf(address(metaVault));
        }

        IBerachainRewardsRegistry.RewardVaultType rewardType = metaVault.getDefaultRewardVaultTypeByAsset(_asset);
        return IBaseMetaVault(metaVault).getStakedBalanceByAssetAndType(_asset, rewardType);
    }
}
