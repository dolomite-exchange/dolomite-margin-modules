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
    uint256 public constant TWO_YEARS = 104 weeks;
    uint256 public constant ONE_WEEK = 1 weeks;

    uint256 public constant FIFTY_PERCENT = .5 ether;
    uint256 public constant FIVE_PERCENT = .05 ether;

    IVeToken public immutable veToken;

    constructor(address _veToken) {
        veToken = IVeToken(_veToken);
    }

    function calculateDiscount(
        uint256 /* _nftId */,
        uint256 /* _duration */,
        bytes memory _extraBytes
    ) external view returns (uint256) {
        (uint256 veNftId, uint256 veLockEndTime) = abi.decode(_extraBytes, (uint256, uint256));
        if (veNftId != type(uint256).max) {
            veLockEndTime = veToken.locked(veNftId).end;
        }
        Require.that(
            veLockEndTime > block.timestamp && veLockEndTime % ONE_WEEK == 0,
            _FILE,
            "Invalid ve lock end timestamp"
        );
        Require.that(
            veLockEndTime - block.timestamp <= TWO_YEARS,
            _FILE,
            "ve lock end timestamp is too old"
        );

        // @dev linearly decays from 50% to 5% from 104 weeks to 1 week, then linearly from 5% to 0% over the last week
        uint256 duration = veLockEndTime - block.timestamp;
        if (duration > ONE_WEEK) {
            return calculateLinearDiscount(duration - ONE_WEEK);
        } else {
            return calculateLinearDiscountWithinOneWeek(duration);
        }
    }

    // @dev Linear formula where y intercept is 5% and slope is 45% over 103 weeks
    function calculateLinearDiscount(
        uint256 _lockDuration
    ) public pure returns (uint256) {
        _lockDuration = _roundUpToNearestWholeWeek(_lockDuration);

        uint256 changeY = _lockDuration * (FIFTY_PERCENT - FIVE_PERCENT) / (TWO_YEARS - ONE_WEEK);
        uint256 discount = FIVE_PERCENT + changeY;

        return discount > FIFTY_PERCENT ? FIFTY_PERCENT : discount;
    }

    // @dev Linear formula where y intercept is 0% and slope is 5% over 1 week
    function calculateLinearDiscountWithinOneWeek(
        uint256 _lockDuration
    ) public pure returns (uint256) {
        uint256 discount = FIVE_PERCENT * _lockDuration / ONE_WEEK;
        return discount > FIVE_PERCENT ? FIVE_PERCENT : discount;
    }

    function _roundUpToNearestWholeWeek(
        uint256 _duration
    ) internal pure returns (uint256) {
        if (_duration % ONE_WEEK == 0) {
            return _duration;
        } else {
            return (_duration / ONE_WEEK * ONE_WEEK) + ONE_WEEK;
        }
    }
}
