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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IVeToken } from "./interfaces/IVeToken.sol";
import { IVesterDiscountCalculator } from "./interfaces/IVesterDiscountCalculator.sol";


/**
 * @title   ExternalVesterDiscountCalculatorV1
 * @author  Dolomite
 *
 * Discount calculator for the external vester contract
 */
contract ExternalVesterDiscountCalculatorV1 is IVesterDiscountCalculator {

    bytes32 private constant _FILE = "ExternalVeDiscountCalculatorV1";

    uint256 public constant BASE = 1 ether;
    uint256 public constant TWO_YEARS = 2 * 365 days;

    uint256 public constant MAX_LOCK_DISCOUNT = .5 ether;
    uint256 public constant END_LOCK_DISCOUNT = .05 ether;

    IVeToken public immutable veToken;

    constructor(address _veToken) {
        veToken = IVeToken(_veToken);
    }

    function calculateDiscount(
        uint256 /* _nftId */,
        uint256 /* _duration */,
        bytes memory _extraBytes
    ) external view returns (uint256) {
        (uint256 veNftId, uint256 veLockDuration) = abi.decode(_extraBytes, (uint256, uint256));
        uint256 lockEnd;
        if (veNftId == type(uint256).max) {
            // @audit This could be a little off because VotingEscrow rounds down to nearest week
            lockEnd = block.timestamp + veLockDuration;
        } else {
            lockEnd = veToken.locked(veNftId).end;
        }
        Require.that(
            block.timestamp < lockEnd,
            _FILE,
            "veNft is not locked"
        );

        if (lockEnd - block.timestamp >= 103 weeks) {
            return MAX_LOCK_DISCOUNT;
        }

        // @dev linearly decays from 50% to 5% from 2 years to 1 week, then linearly from 5% to 0% over last week
        if (lockEnd - block.timestamp > 1 weeks) {
            return _calculateLinearDecay(
                MAX_LOCK_DISCOUNT,
                END_LOCK_DISCOUNT,
                lockEnd - TWO_YEARS,
                TWO_YEARS - 1 weeks,
                block.timestamp
            );
        } else {
            return _calculateLinearDecay(
                END_LOCK_DISCOUNT,
                0,
                lockEnd - 1 weeks,
                1 weeks,
                block.timestamp
            );
        }
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
