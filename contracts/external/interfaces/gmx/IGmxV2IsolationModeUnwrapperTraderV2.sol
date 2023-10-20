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

import { IGmxV2IsolationModeTraderBase } from "./IGmxV2IsolationModeTraderBase.sol";
import { IGmxWithdrawalCallbackReceiver } from "./IGmxWithdrawalCallbackReceiver.sol";
import { IUpgradeableIsolationModeUnwrapperTrader } from "../IUpgradeableIsolationModeUnwrapperTrader.sol";


/**
 * @title   IGmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 */
interface IGmxV2IsolationModeUnwrapperTraderV2 is
    IGmxV2IsolationModeTraderBase,
    IUpgradeableIsolationModeUnwrapperTrader,
    IGmxWithdrawalCallbackReceiver
{

    // ================================================
    // ==================== Structs ===================
    // ================================================

    struct WithdrawalInfo {
        bytes32 key;
        address vault;
        uint256 accountNumber;
        /// @dev The amount of GM tokens that is being sold
        uint256 inputAmount;
        address outputToken;
        /// @dev initially 0 until the withdrawal is executed
        uint256 outputAmount;
        bool isRetryable;
    }

    // ================================================
    // ===================== Enums ====================
    // ================================================

    enum TradeType {
        FromWithdrawal,
        FromDeposit
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event WithdrawalCreated(bytes32 indexed key);
    event WithdrawalExecuted(bytes32 indexed key);
    event WithdrawalFailed(bytes32 indexed key, string reason);
    event WithdrawalCancelled(bytes32 indexed key);

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

    /**
     * Can be called by a valid handler to re-execute a stuck withdrawal if it failed in the typical GMX callback but
     * can now be processed without a liquidation.
     * @param  _key  The key of the withdrawal to re-execute
     */
    function executeWithdrawalForRetry(bytes32 _key) external;

    /**
     * Saves the follow withdrawal info as a struct. Only callable by the user's vault
     */
    function vaultCreateWithdrawalInfo(
        bytes32 _key,
        uint256 _accountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    ) external;

    function getWithdrawalInfo(bytes32 _key) external view returns (WithdrawalInfo memory);
}
