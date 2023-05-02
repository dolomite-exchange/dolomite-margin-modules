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
 * @title   IPlutusVaultGLPFarm
 * @author  Dolomite
 *
 * @notice  Interface for staking plvGLP for PLS rewards.
 */
interface IPlutusVaultGLPFarm {

    function setWhitelist(address _whitelist) external;

    function deposit(uint256 _amount) external;

    /**
     * @notice  Withdraws plvGLP from the staking contract and sends it to `msg.sender`. This call fails if `paused()`
     *          returns true. Calling this function does *not* harvest PLS rewards.
     *
     * @param  _amount  The amount of plvGLP to withdraw from the staking contract
     */
    function withdraw(uint256 _amount) external;

    function harvest() external;

    function emergencyWithdraw() external;

    function owner() external view returns (address);

    function whitelist() external view returns (address);

    function paused() external view returns (bool);

    function userInfo(address _user) external view returns (uint96 _balance, uint128 _plsRewardDebt);
}
