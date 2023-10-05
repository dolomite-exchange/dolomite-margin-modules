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

import { IOARB } from "./IOARB.sol";
import { IDolomiteRegistry } from "../IDolomiteRegistry.sol";


/**
 * @title   IEmitter
 * @author  Dolomite
 *
 * Interface for an emitter that is inspired by MasterChef to reward oARB tokens
 */
interface IEmitter {

    // =================================================
    // ==================== Structs ====================
    // =================================================

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    struct PoolInfo {
        uint256 marketId;
        uint256 totalPar;
        uint256 allocPoint;
        uint256 lastRewardTime;
        uint256 accOARBPerShare;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event Deposit(address indexed user, uint256 indexed marketId, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed marketId, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed marketId, uint256 amount);

    // ======================================================
    // ================== User Functions ===================
    // ======================================================

    /**
     * @notice  Deposit tokens to Emmiter for oARB allocation
     *
     * @param  _fromAccountNumber   The account number to tranfer funds from
     * @param  _marketId            The market id of the token to deposit
     * @param  _amountWei           The amount wei of the token to deposit
     */
    function deposit(uint256 _fromAccountNumber, uint256 _marketId, uint256 _amountWei) external;

    /**
     * @notice  Withdraws tokens from the Emitter contract
     *
     * @param  _marketId        The market id of the token to deposit
     * @param  _amountWei       The amount of the token to withdraw
     */
    function withdraw(uint256 _marketId, uint256 _amountWei) external;

    /**
     * @notice  Emergency withdraws tokens from the Emitter contract
     *          WARNING: This will forfeit all vesting progress
     *
     * @param  _marketId        The market id of the token to deposit
     */
    function emergencyWithdraw(uint256 _marketId) external;

    /**
     * @notice  Update reward variables of the given pool to be up-to-date
     *
     * @param  _marketId    The market id of the pool to update
     */
    function updatePool(uint256 _marketId) external;

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    /**
     * @notice  Adds a new market id to the pool. Can only be called by the owner.
     *
     * @param  _marketId    The id of the position that is fully vested
     * @param  _allocPoint  The id of the position that is fully vested
     */
    function ownerAddPool(uint256 _marketId, uint256 _allocPoint, bool _withUpdate) external;

    /**
     * @notice  Update the given market id's allocation point. Can only be called by the owner
     *
     * @param  _marketId    The id of the position that is fully vested
     * @param  _allocPoint  The id of the position that is fully vested
     */
    function ownerSetPool(uint256 _marketId, uint256 _allocPoint) external;

    function ownerSetOARBPerSecond(uint256 _oARBPerSecond) external;

    // =================================================
    // ================= View Functions ================
    // =================================================

    function DOLOMITE_REGISTRY() external view returns (IDolomiteRegistry);

    function oARB() external view returns (IOARB);

    function oARBPerSecond() external view returns (uint256);

    // @todo come back to this
    // function userInfo(uint256 _marketId, uint256 _accountHash) external view returns (UserInfo memory);

    // function poolInfo(uint256 _marketId) external view returns (PoolInfo memory);

    function totalAllocPoint() external view returns (uint256);

    function startTime() external view returns (uint256);
}
