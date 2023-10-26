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

import { IGmxWithdrawalCallbackReceiver } from "./IGmxWithdrawalCallbackReceiver.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../IUpgradeableAsyncIsolationModeUnwrapperTrader.sol";


/**
 * @title   IGmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 */
interface IGmxV2IsolationModeUnwrapperTraderV2 is
    IUpgradeableAsyncIsolationModeUnwrapperTrader,
    IGmxWithdrawalCallbackReceiver
{

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    /**
     * Notifies the unwrapper that it'll be entered for a trade from the unwrapper. This allows it to modify the action
     * length
     */
    function handleGmxCallbackFromWrapperBefore() external;

    /**
     * Reverts any changes made in `handleGmxCallbackFromWrapperBefore`. Can only be called by the
     * IGmxV2IsolationModeWrapperTraderV2
     */
    function handleGmxCallbackFromWrapperAfter() external;
}
