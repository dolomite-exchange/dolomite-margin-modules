// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { GmxEventUtils } from "../lib/GmxEventUtils.sol";


/**
 * @title   IGmxV22WithdrawalCallbackReceiver
 * @author  Dolomite
 *
 */
interface IGmxV22WithdrawalCallbackReceiver {
        // @dev called after a withdrawal execution
    // @param key the key of the withdrawal
    // @param withdrawal the withdrawal that was executed
    function afterWithdrawalExecution(bytes32 key, GmxEventUtils.EventLogData memory withdrawal, GmxEventUtils.EventLogData memory eventData) external;

    // @dev called after a withdrawal cancellation
    // @param key the key of the withdrawal
    // @param withdrawal the withdrawal that was cancelled
    function afterWithdrawalCancellation(bytes32 key, GmxEventUtils.EventLogData memory withdrawal, GmxEventUtils.EventLogData memory eventData) external;
}