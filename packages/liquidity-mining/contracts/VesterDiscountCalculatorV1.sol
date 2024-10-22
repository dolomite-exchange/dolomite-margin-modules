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

import { IVesterDiscountCalculator } from "./interfaces/IVesterDiscountCalculator.sol";


/**
 * @title   VesterDiscountCalculatorV1
 * @author  Dolomite
 *
 */
contract VesterDiscountCalculatorV1 is IVesterDiscountCalculator {

    /// @dev 20% for instant exit
    uint256 public constant BASE = 2_000;
    /// @dev 2% per week
    uint256 public constant AMOUNT_PER_WEEK = 200;
    uint256 public constant ONE_WEEK_SECONDS = 1 weeks;

    function calculateDiscount(uint256 /* _nftId */, uint256 _duration) external pure returns (uint256) {
        return BASE + (AMOUNT_PER_WEEK * _duration / ONE_WEEK_SECONDS);
    }
}
