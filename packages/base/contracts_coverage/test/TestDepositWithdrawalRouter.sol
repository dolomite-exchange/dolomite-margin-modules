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

import { InternalSafeDelegateCallLib } from "../lib/InternalSafeDelegateCallLib.sol";
import { DepositWithdrawalRouter } from "../routers/DepositWithdrawalRouter.sol";

/**
 * @title   TestDepositWithdrawalRouter
 * @author  Dolomite
 *
 * @notice  Contract for testing the DepositWithdrawalRouter
 */
contract TestDepositWithdrawalRouter is DepositWithdrawalRouter {
    using InternalSafeDelegateCallLib for address;

    constructor(
        address _payableToken,
        address _dolomiteRegistry
    ) DepositWithdrawalRouter(_payableToken, _dolomiteRegistry) {}

    function callFunctionAndTriggerReentrancy(
        bytes calldata _callDataWithSelector
    ) external payable nonReentrant {
        address(this).safeDelegateCall(_callDataWithSelector);
    }
}
