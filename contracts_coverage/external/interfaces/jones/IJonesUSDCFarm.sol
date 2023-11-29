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


/**
 * @title   IJonesUSDCFarm
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Jones DAO's jUSDC farming contract
 *          (0x0aEfaD19aA454bCc1B1Dd86e18A7d58D0a6FAC38)
 */
interface IJonesUSDCFarm {

    // ==================================================================
    // =========================== Structs ==============================
    // ==================================================================

    struct PoolInfo {
        uint128 accSushiPerShare;
        uint64 lastRewardTime;
        uint64 allocPoint;
        uint256 depositIncentives;
    }

    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
    }

    // ==================================================================
    // ========================== Functions =============================
    // ==================================================================

    /**
     * @notice Deposit LP tokens to MCV2 for ARB allocation.
     *
     * @param  _poolId  The index of the pool. See `poolInfo`.
     * @param  _amount  LP token amount to deposit.
     * @param  _to      The receiver of `amount` deposit benefit.
     */
    function deposit(uint256 _poolId, uint256 _amount, address _to) external;

    /**
     * @notice Withdraw LP tokens from MCV2.
     *
     * @param  _poolId  The index of the pool. See `poolInfo`.
     * @param  _amount  LP token amount to withdraw.
     * @param  _to      The receiver of the LP tokens.
     */
    function withdraw(uint256 _poolId, uint256 _amount, address _to) external;

    /**
     * @notice Harvest proceeds for transaction sender to `to`
     *
     * @param  _poolId  The index of the pool. See `poolInfo`.
     * @param  _to      Receiver of ARB rewards.
     */
    function harvest(uint256 _poolId, address _to) external;

    /**
     * @notice For seeing pending ARB on frontend
     *
     * @param  _poolId  The index of the pool. See `poolInfo`
     * @param  _user    Address of user
     * @return The pending ARB reward for a given user
     */
    function pendingSushi(uint256 _poolId, address _user) external view returns (uint256);

    /**
     *
     * @return True if deposit incentives are active, false if they're disabled
     */
    function incentivesOn() external view returns (bool);

    /**
     *
     * @return The address to receive deposit incentives or the 0x0 address if there is no receiver
     */
    function incentiveReceiver() external view returns (address);

    /**
     *
     * @param  _poolId  The index of the pool. See `poolInfo`
     * @return The pool info for the corresponding `_poolId`
     */
    function poolInfo(uint256 _poolId) external view returns (PoolInfo memory);

    /**
     *
     * @param  _poolId  The index of the pool. See `poolInfo`
     * @param  _user    Address of user
     * @return The pool info for the corresponding `_poolId`
     */
    function userInfo(uint256 _poolId, address _user) external view returns (UserInfo memory);
}
