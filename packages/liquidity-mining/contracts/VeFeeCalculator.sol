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
    uint256 private constant TWO_YEARS = 2 * 365 days;

    uint256 private constant _STARTING_RECOUP_FEE = .5 ether; // 50%
    uint256 private constant _STARTING_BURN_FEE = .4 ether; // 40%
    uint256 private constant _DECAY_DURATION = 8 weeks;

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

    function ownerSetDecayTimestamp(uint256 _decayTimestamp) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDecayTimestamp(_decayTimestamp);
    }

    function getEarlyWithdrawalFees(
        uint256 _amount,
        uint256 _lockEndTime
    ) external view returns (uint256, uint256) {
        if (block.timestamp >= _lockEndTime) {
            return (0, 0);
        }

        assert(decayTimestamp != 0);
        uint256 burnFeeAmount = _calculateLinearDecay(
            /* startValue = */ _STARTING_BURN_FEE,
            /* endValue = */ burnFee,
            /* startTime = */ decayTimestamp,
            /* duration = */ _DECAY_DURATION,
            /* time = */ block.timestamp
        ) * _amount / BASE;

        // @dev scales down from 50% to 5% from 2 years to 1 week, then locked at 5% for last week
        uint256 recoupFeeAmount = _calculateLinearDecay(
            /* startValue = */ _STARTING_RECOUP_FEE,
            /* endValue = */ .05 ether,
            /* startTime = */ _lockEndTime - TWO_YEARS,
            /* duration = */ TWO_YEARS - 1 weeks,
            /* time = */ block.timestamp
        ) * _amount / BASE;

        return (burnFeeAmount, recoupFeeAmount);
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetBurnFee(uint256 _burnFee) internal {
        burnFee = _burnFee;
        emit BurnFeeSet(_burnFee);
    }

    function _ownerSetDecayTimestamp(uint256 _decayTimestamp) internal {
        decayTimestamp = _decayTimestamp;
        emit DecayTimestampSet(_decayTimestamp);
    }

    function _calculateLinearDecay(
        uint256 _startValue,
        uint256 _endValue,
        uint256 _startTime,
        uint256 _duration,
        uint256 _time
    ) internal pure returns (uint256) {
        if (_time >= _startTime + _duration) {
            return _endValue;
        } else if (_time <= _startTime) {
            return _startValue;
        } else {
            return
                _startValue -
                ((_startValue - _endValue) * (_time - _startTime)) /
                _duration;
        }
    }
}
