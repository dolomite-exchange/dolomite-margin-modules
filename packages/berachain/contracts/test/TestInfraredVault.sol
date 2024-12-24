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
contract TestInfraredVault is IInfraredVault, ERC20 {

    address public immutable asset;
    address[] public rewardTokens;
    mapping(address => uint256) public rewardAmounts;


    constructor(address _asset) ERC20("TestInfraredVault", "TEST") {
        asset = _asset;
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
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            IERC20 token = IERC20(rewardTokens[i]);
            uint256 reward = rewardAmounts[address(token)];
            token.transfer(msg.sender, reward);
        }
    }

    function exit() external {
        getReward();
        withdraw(balanceOf(msg.sender));
    }

    function addReward(address token, uint256 amount) external {
        rewardAmounts[token] += amount;
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    function getAllRewardsForUser(address /* account */) external view returns (UserReward[] memory userRewards) {
        userRewards = new UserReward[](rewardTokens.length);
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
}
