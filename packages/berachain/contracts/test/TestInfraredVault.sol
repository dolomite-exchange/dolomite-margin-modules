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

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IInfraredVault } from "../interfaces/IInfraredVault.sol";


/**
 * @title   TestInfraredVault
 * @author  Dolomite
 *
 * @notice  Test infrared vault
 */
contract TestInfraredVault is ERC20 {

    address public immutable asset;
    address[] public rewardTokens;
    mapping(address => uint256) public rewardAmounts;
    bool public paused;


    constructor(address _asset) ERC20("TestInfraredVault", "TEST") {
        asset = _asset;
    }

    function setPaused(bool _paused) external {
        paused = _paused;
    }

    function setRewardTokens(address[] memory _rewardTokens) external {
        rewardTokens = _rewardTokens;
    }

    function stake(uint256 amount) external {
        _mint(msg.sender, amount);
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public {
        _burn(msg.sender, amount);
        IERC20(asset).transfer(msg.sender, amount);
    }

    function getReward() public {
        _getReward(msg.sender);
    }

    function getRewardForUser(address _user) public {
        _getReward(_user);
    }

    function exit() external {
        getReward();
        withdraw(balanceOf(msg.sender));
    }

    function notifyRewardAmount(address rewardToken, uint256 reward) external {
        rewardAmounts[rewardToken] += reward;
        IERC20(rewardToken).transferFrom(msg.sender, address(this), reward);
    }

    function addReward(address token, uint256 amount) external {
        rewardAmounts[token] += amount;
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    function getAllRewardsForUser(
        address /* account */
    ) external view returns (IInfraredVault.UserReward[] memory userRewards) {
        userRewards = new IInfraredVault.UserReward[](rewardTokens.length);
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            IERC20 token = IERC20(rewardTokens[i]);
            uint256 reward = rewardAmounts[address(token)];

            userRewards[i].token = address(token);
            userRewards[i].amount = reward;
        }
    }

    function earned(address /* account */, address rewardToken) external view returns (uint256) {
        return rewardAmounts[address(rewardToken)];
    }

    function getAllRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }

    function lastTimeRewardApplicable(address /* _rewardsToken */) external view returns (uint256) {
        return block.timestamp;
    }

    function rewardData(
        address /* _rewardsToken */
    ) external pure returns (
        address rewardsDistributor,
        uint256 rewardsDuration,
        uint256 periodFinish,
        uint256 rewardRate,
        uint256 lastUpdateTime,
        uint256 rewardPerTokenStored,
        uint256 rewardResidual
    ) {
        rewardsDistributor = address(0);
        rewardsDuration = 0;
        periodFinish = 0;
        rewardRate = 0;
        lastUpdateTime = 0;
        rewardPerTokenStored = 0;
        rewardResidual = 0;
    }

    function _getReward(address _user) internal {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            IERC20 token = IERC20(rewardTokens[i]);
            uint256 reward = rewardAmounts[address(token)];
            rewardAmounts[address(token)] = 0;
            token.transfer(_user, reward);
        }
    }
}
