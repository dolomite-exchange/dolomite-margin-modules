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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IVeFeeCalculator } from "./interfaces/IVeFeeCalculator.sol";


/**
 * @title   VeFeeCalculator
 * @author  Dolomite
 *
 * Fee calculator for the VotingEscrow contract
 */
contract VeFeeCalculator is IVeFeeCalculator, OnlyDolomiteMargin {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VeFeeCalculator";
    uint256 private constant BASE = 1 ether;
    uint256 private constant TWO_YEARS = 104 weeks;

    uint256 private constant _STARTING_RECOUP_FEE = .5 ether; // 50%
    uint256 private constant _FIVE_PERCENT = .05 ether; // 5%

    // =========================================================
    // ==================== State Variables ====================
    // =========================================================

    uint256 public burnFee;
    uint256 public decayTimestamp;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(address _dolomiteMargin) OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        _ownerSetBurnFee(.05 ether);
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function ownerSetBurnFee(uint256 _burnFee) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBurnFee(_burnFee);
    }

    function getEarlyWithdrawalFees(
        uint256 _amount,
        uint256 _lockEndTime
    ) external view returns (uint256, uint256) {
        if (block.timestamp >= _lockEndTime) {
            return (0, 0);
        }

        assert(decayTimestamp != 0);
        uint256 burnFeeAmount = burnFee * _amount / BASE;
        uint256 recoupFeeAmount = _calculateRecoupFee(_lockEndTime - block.timestamp) * _amount / BASE;

        return (burnFeeAmount, recoupFeeAmount);
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetBurnFee(uint256 _burnFee) internal {
        burnFee = _burnFee;
        emit BurnFeeSet(_burnFee);
    }

    // @dev linear formula where y intercept is 5% for the first week then slope is 45% over 103 weeks
    function _calculateRecoupFee(uint256 _duration) internal pure returns (uint256) {
        if (_duration <= 1 weeks) {
            return _FIVE_PERCENT;
        }

        _duration = _duration - 1 weeks; // @dev since linear decay is over 103 weeks need to adjust by 1 week
        uint256 changeY = _duration * (_STARTING_RECOUP_FEE - _FIVE_PERCENT) / (TWO_YEARS - 1 weeks);
        uint256 fee = _FIVE_PERCENT + changeY;

        return fee > _STARTING_RECOUP_FEE ? _STARTING_RECOUP_FEE : fee;
    }
}
