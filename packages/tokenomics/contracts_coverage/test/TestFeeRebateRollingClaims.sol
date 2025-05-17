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

import { InternalSafeDelegateCallLib } from "@dolomite-exchange/modules-base/contracts/lib/InternalSafeDelegateCallLib.sol"; // solhint-disable-line max-line-length
import { FeeRebateRollingClaims } from "../FeeRebateRollingClaims.sol";


/**
 * @title   TestFeeRebateRollingClaims
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestFeeRebateRollingClaims is FeeRebateRollingClaims {
    using InternalSafeDelegateCallLib for address;

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) FeeRebateRollingClaims(
        _dolomiteRegistry,
        _dolomiteMargin
    ) {} // solhint-disable-line

    function callFunctionAndTriggerReentrancy(
        bytes calldata _callDataWithSelector
    ) external payable nonReentrant {
        address(this).safeDelegateCall(_callDataWithSelector);
    }
}
