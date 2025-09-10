// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { GmxEventUtils } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxEventUtils.sol";

/**
 * @title   IGlvV22WithdrawalCallbackReceiver
 *
 * @notice  IGlvV22WithdrawalCallbackReceiver library from GMX
 * @dev interface for a glvWithdrawal callback contract
 */
interface IGlvV22WithdrawalCallbackReceiver {
    // @dev called after a glvWithdrawal execution
    // @param key the key of the glvWithdrawal
    // @param glvWithdrawal the glvWithdrawal that was executed
    function afterGlvWithdrawalExecution(
        bytes32 key,
        GmxEventUtils.EventLogData memory glvWithdrawalData,
        GmxEventUtils.EventLogData memory eventData
    ) external;

    // @dev called after a glvWithdrawal cancellation
    // @param key the key of the glvWithdrawal
    // @param glvWithdrawal the glvWithdrawal that was cancelled
    function afterGlvWithdrawalCancellation(
        bytes32 key,
        GmxEventUtils.EventLogData memory glvWithdrawalData,
        GmxEventUtils.EventLogData memory eventData
    ) external;
}
