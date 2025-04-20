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
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { VestingClaims } from "./VestingClaims.sol";


/**
 * @title   StrategicVestingClaims
 * @author  Dolomite
 *
 * Strategic vesting claims contract for DOLO tokens
 */
contract StrategicVestingClaims is VestingClaims {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "StrategicVestingClaims";

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        uint256 _tgeTimestamp,
        uint256 _duration,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) VestingClaims(_dolo, _tgeTimestamp, _duration, _dolomiteRegistry, _dolomiteMargin) {
    }

    function _vestingSchedule(
        uint256 _totalAllocation,
        uint64 _timestamp
    ) internal override view returns (uint256) {
        if (_timestamp < TGE_TIMESTAMP) {
            return 0;
        } else if (_timestamp >= TGE_TIMESTAMP + DURATION) {
            return _totalAllocation;
        } else {
            uint256 amountUpfront = _totalAllocation / 10; // 10% up front
            uint256 amountRemaining = _totalAllocation - amountUpfront; // 90% vested over duration
            uint256 vestedAmount = amountRemaining * (_timestamp - TGE_TIMESTAMP) / DURATION;
            return amountUpfront + vestedAmount;
        }
    }
}
