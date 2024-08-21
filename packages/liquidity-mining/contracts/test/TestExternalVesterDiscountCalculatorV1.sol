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

import { ExternalVesterDiscountCalculatorV1 } from "../ExternalVesterDiscountCalculatorV1.sol";


/**
 * @title   TestExternalVesterDiscountCalculatorV1
 * @author  Dolomite
 *
 * Test implementation for ExternalVesterDiscountCalculatorV1
 */
contract TestExternalVesterDiscountCalculatorV1 is ExternalVesterDiscountCalculatorV1 {

    constructor(address _veToken) ExternalVesterDiscountCalculatorV1(_veToken) {}

    function testLinearDecayMax(
        uint256 _startValue,
        uint256 _endValue,
        uint256 _startTime,
        uint256 _duration
    ) external view returns (uint256) {
        return _calculateLinearDecay(
            _startValue,
            _endValue,
            _startTime,
            _duration,
            block.timestamp
        );
    }
}
