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

import { GmxDeposit } from "./GmxDeposit.sol";
import { GmxEventUtils } from "./GmxEventUtils.sol";


/**
 * @title   IGmxDepositCallbackReceiver
 * @author  Dolomite
 *
 */
interface IGmxDepositCallbackReceiver {

    // @dev called after a deposit execution
    // @param  key the key of the deposit
    // @param  deposit the deposit that was executed
    function afterDepositExecution(
        bytes32 _key,
        GmxDeposit.DepositProps memory _deposit,
        GmxEventUtils.EventLogData memory _eventData
    ) external;

    // @dev called after a deposit cancellation
    // @param  key the key of the deposit
    // @param  deposit the deposit that was cancelled
    function afterDepositCancellation(
        bytes32 _key,
        GmxDeposit.DepositProps memory _deposit,
        GmxEventUtils.EventLogData memory _eventData
    ) external;
}
