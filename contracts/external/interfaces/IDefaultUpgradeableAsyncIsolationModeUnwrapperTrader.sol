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

import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "./IUpgradeableAsyncIsolationModeUnwrapperTrader.sol";


/**
 * @title   IDefaultUpgradeableAsyncIsolationModeUnwrapperTrader
 * @author  Dolomite
 *
 * Interface for an upgradeable contract that can convert an isolation mode token into another token.
 */
interface IDefaultUpgradeableAsyncIsolationModeUnwrapperTrader is IUpgradeableAsyncIsolationModeUnwrapperTrader {

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    /**
     * Can be called by a valid handler to re-execute a stuck withdrawal. This should be used if the withdrawal can't
     * be liquidated (IE because the account is over-collateralized now).
     *
     * @param  _key  The key of the withdrawal to re-execute
     */
    function executeWithdrawalForRetry(bytes32 _key) external;
}
