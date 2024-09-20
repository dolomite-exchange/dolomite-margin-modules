// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { GmxEventUtils } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxEventUtils.sol";
import { GlvWithdrawal } from "../lib/GlvWithdrawal.sol";

/**
 * @title   IGlvWithdrawalCallbackReceiver
 *
 * @notice  IGlvWithdrawalCallbackReceiver library from GMX
 * @dev interface for a glvWithdrawal callback contract
 */
interface IGlvWithdrawalCallbackReceiver {
    // @dev called after a glvWithdrawal execution
    // @param  key the key of the glvWithdrawal
    // @param  glvWithdrawal the glvWithdrawal that was executed
    function afterGlvWithdrawalExecution(
        bytes32 key,
        GlvWithdrawal.Props memory glvWithdrawal,
        GmxEventUtils.EventLogData memory eventData
    ) external;

    // @dev called after a glvWithdrawal cancellation
    // @param  key the key of the glvWithdrawal
    // @param  glvWithdrawal the glvWithdrawal that was cancelled
    function afterGlvWithdrawalCancellation(
        bytes32 key,
        GlvWithdrawal.Props memory glvWithdrawal,
        GmxEventUtils.EventLogData memory eventData
    ) external;
}
