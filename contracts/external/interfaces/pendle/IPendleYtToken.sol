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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title   IPendleYtToken
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Pendle's yield tokens (YTs).
 */
interface IPendleYtToken is IERC20 {
    /**
     * @notice Redeems interests and rewards for `user`
     * @param redeemInterest will only transfer out interest for user if true
     * @param redeemRewards will only transfer out rewards for user if true
     * @dev With YT yielding interest in the form of SY, which is redeemable by users, the reward
     * distribution should be based on the amount of SYs that their YT currently represent, plus
     * their dueInterest. It has been proven and tested that _rewardSharesUser will not change over
     * time, unless users redeem their dueInterest or redeemPY. Due to this, it is required to
     * update users' accruedReward STRICTLY BEFORE transferring out their interest.
     * @dev Interest yield is denominated in the same unit as the interest bearing token
     * @dev Reward yield is given out in a different unit than the interest bearing token
     */
    function redeemDueInterestAndRewards(
        address user,
        bool redeemInterest,
        bool redeemRewards
    ) external returns (uint256 interestOut, uint256[] memory rewardsOut);

    function getRewardTokens() external view returns (address[] memory);

    function expiry() external view returns (uint256);

    function isExpired() external view returns (bool);

    function SY() external view returns (address);
}
