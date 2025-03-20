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

import { IBerachainRewardsRegistry } from "./IBerachainRewardsRegistry.sol";


/**
 * @title   IBaseMetaVault
 * @author  Dolomite
 *
 */
interface IBaseMetaVault {

    // ================================================
    // ================== Functions ===================
    // ================================================

    function setDefaultRewardVaultTypeByAsset(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external;

    function stakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external;

    function unstakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external;

    function stake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 amount) external;

    function unstake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 amount) external;

    function getReward(address _asset) external;

    function exit(address _asset, bool _isDToken) external;

    function chargeDTokenFee(
        address _asset,
        uint256 _marketId,
        uint256 _amount
    ) external returns (uint256 _feeAmount);

    function getDefaultRewardVaultTypeByAsset(
        address _asset
    ) external view returns (IBerachainRewardsRegistry.RewardVaultType);

    function getStakedBalanceByAssetAndType(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external view returns (uint256);

    /**
     * @return  The address of the Berachain Rewards Registry, which contains the relevant addresses for the Dolomite
     *          Meta Vault system (for depositing PoL-enabled assets into PoL) as well as tracking all supported PoL
     *          providers.
     */
    function REGISTRY() external view returns (IBerachainRewardsRegistry);

    /**
     * @return  The user that owns this Meta Vault.
     */
    function OWNER() external view returns (address);
}
