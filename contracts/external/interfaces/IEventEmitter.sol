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
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "./IUpgradeableAsyncIsolationModeWrapperTrader.sol";


/**
 * @title   IEventEmitter
 * @author  Dolomite
 *
 * Interface for a yield farming contract that's inspired by MasterChef
 */
interface IEventEmitter {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event AsyncDepositCreated(
        bytes32 indexed key,
        address token,
        IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo deposit
    );

    event AsyncDepositExecuted(bytes32 indexed key);

    event AsyncDepositFailed(bytes32 indexed key, string reason);

    event AsyncDepositCancelled(bytes32 indexed key);

    event AsyncDepositCancelledFailed(bytes32 indexed key, string reason);

    event AsyncWithdrawalCreated(
        bytes32 indexed key,
        address token,
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo withdrawal
    );

    event AsyncWithdrawalExecuted(bytes32 indexed key);

    event AsyncWithdrawalFailed(bytes32 indexed key, string reason);

    event AsyncWithdrawalCancelled(bytes32 indexed key);

    // ================================================
    // ================== Functions ===================
    // ================================================

    function emitAsyncDepositCreated(
        bytes32 _key,
        address _token,
        IUpgradeableAsyncIsolationModeWrapperTrader.DepositInfo calldata _deposit
    ) external;

    function emitAsyncDepositExecuted(bytes32 _key, address _token) external;

    function emitAsyncDepositFailed(bytes32 _key, address _token, string calldata _reason) external;

    function emitAsyncDepositCancelled(bytes32 _key, address _token) external;

    function emitAsyncDepositCancelledFailed(bytes32 _key, address _token, string calldata _reason) external;

    function emitAsyncWithdrawalCreated(
        bytes32 _key,
        address _token,
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo calldata _withdrawal
    ) external;

    function emitAsyncWithdrawalExecuted(bytes32 _key, address _token) external;

    function emitAsyncWithdrawalFailed(bytes32 _key, address _token, string calldata _reason) external;

    function emitAsyncWithdrawalCancelled(bytes32 _key, address _token) external;
}
