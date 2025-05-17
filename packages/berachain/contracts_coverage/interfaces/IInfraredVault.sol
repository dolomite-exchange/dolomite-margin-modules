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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title   IInfraredVault
 * @author  Dolomite
 *
 */
interface IInfraredVault is IERC20 {

    struct UserReward {
        address token;
        uint256 amount;
    }

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward() external;

    function exit() external;

    function notifyRewardAmount(address rewardToken, uint256 reward) external;

    function getAllRewardsForUser(address _user) external view returns (UserReward[] memory);

    function paused() external view returns (bool);

    function earned(address account, address rewardToken) external view returns (uint256);

    function getAllRewardTokens() external view returns (address[] memory);

    function rewardPerToken(address _rewardsToken) external view returns (uint256);

    function rewardData(address _rewardsToken) external view returns (
        address rewardsDistributor,
        uint256 rewardsDuration,
        uint256 periodFinish,
        uint256 rewardRate,
        uint256 lastUpdateTime,
        uint256 rewardPerTokenStored,
        uint256 rewardResidual
    );

    function lastTimeRewardApplicable(address _rewardsToken) external view returns (uint256);
    function rewardTokens(uint256 index) external view returns (address);
}
