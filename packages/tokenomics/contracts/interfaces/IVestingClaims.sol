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

import { IBaseClaim } from "./IBaseClaim.sol";


/**
 * @title   IVestingClaims
 * @author  Dolomite
 *
 * @notice  Interface for DOLO vesting claims contract
 */
interface IVestingClaims is IBaseClaim {

    struct VestingClaimsStorage {
        mapping(address => uint256) released;
        mapping(address => uint256) allocatedAmount;
    }

    event AllocatedAmountSet(address indexed user, uint256 allocatedAmount);
    event InvestorRevoked(address indexed user, uint256 amount);

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function ownerSetAllocatedAmounts(
        address[] memory _users,
        uint256[] memory _allocatedAmounts
    ) external;

    function ownerRevokeInvestor(
        address _user,
        address _recipient
    ) external;

    function claim() external;

    // ======================================================
    // ======================= View Functions ================
    // ======================================================

    function allocatedAmount(address _user) external view returns (uint256);

    function released(address _user) external view returns (uint256);

    function releasable(uint256 _totalAllocation, address _user) external view returns (uint256);
    
    
}
