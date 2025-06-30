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

import { IDolomiteInterestSetter } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteInterestSetter.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestInterestSetter
 * @author  Dolomite
 *
 * @notice  Interface contract for setting the interest rate for certain tokens for testing
 */
contract TestInterestSetter is IDolomiteInterestSetter {

    mapping (address => InterestRate) public g_interestRates; // solhint-disable-line var-name-mixedcase

    function setInterestRate(
        address token,
        InterestRate calldata rate
    ) external {
        g_interestRates[token] = rate;
    }

    function getInterestRate(
        address token,
        uint256 /* borrowWei */,
        uint256 /* supplyWei */
    )
    external
    view
    returns (InterestRate memory) {
        return g_interestRates[token];
    }

    function interestSetterType() external pure returns (InterestSetterType) {
        return InterestSetterType.None;
    }
}
