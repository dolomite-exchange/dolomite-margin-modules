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

import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   IDolomiteChef
 * @author  Dolomite
 *
 * Interface for a yield farming contract that's inspired by MasterChef
 */
interface IDolomiteChef {

    // ==================================================
    // =================== Structs ======================
    // ==================================================

    struct UserInfo {
        IDolomiteStructs.Par balancePar;
        IDolomiteStructs.Par rewardTokenRewardDebtPar;
    }

    // ==================================================
    // =================== Events =======================
    // ==================================================

    event LastRewardUpdatedTimestampSet(uint32 _timestamp);
    event RewardTokenWeiPerSecondSet(uint256 _rewardTokenPerSecondWei);
    event Deposit(address indexed _accountOwner, uint256 _accountNumber, uint256 _amountWei);
    event Withdraw(address indexed _accountOwner, uint256 _accountNumber, uint256 _amountWei);
    event Harvest(address indexed _accountOwner, uint256 _accountNumber, uint256 _amountWei);
    event EmergencyWithdraw(address indexed _accountOwner, uint256 _accountNumber, uint256 _amountWei);
}
