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

import { IBerachainRewardsRegistry } from "./IBerachainRewardsRegistry.sol";


/**
 * @title   IBerachainRewardsMetaVault
 * @author  Dolomite
 *
 */
interface IBerachainRewardsMetaVault {

    event ValidatorSet(address validator);

    function stake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 amount) external;

    function unstake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 amount) external;

    function getReward(address _asset, IBerachainRewardsRegistry.RewardVaultType _type) external returns (uint256);

    function exit(address _asset, IBerachainRewardsRegistry.RewardVaultType _type) external;

    function delegateBGT(address _delegatee) external;

    function withdrawBGTAndRedeem(address _recipient, uint256 _amount) external;

    function REGISTRY() external view returns (IBerachainRewardsRegistry);

    function OWNER() external view returns (address);
}
