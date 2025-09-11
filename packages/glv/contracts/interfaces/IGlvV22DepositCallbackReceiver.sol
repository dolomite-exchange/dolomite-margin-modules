// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { GmxEventUtils } from "@dolomite-exchange/modules-gmx-v2/contracts/lib/GmxEventUtils.sol";


/**
 * @title   IGlvV22DepositCallbackReceiver
 *
 * @notice  IGlvV22DepositCallbackReceiver library from GMX
 * @dev interface for a glvDeposit callback contract
 */
interface IGlvV22DepositCallbackReceiver {
    // @dev called after a glvDeposit execution
    // @param key the key of the glvDeposit
    // @param glvDeposit the glvDeposit that was executed
    function afterGlvDepositExecution(
        bytes32 key,
        GmxEventUtils.EventLogData memory glvDepositData,
        GmxEventUtils.EventLogData memory eventData
    ) external;

    // @dev called after a glvDeposit cancellation
    // @param key the key of the glvDeposit
    // @param glvDeposit the glvDeposit that was cancelled
    function afterGlvDepositCancellation(
        bytes32 key,
        GmxEventUtils.EventLogData memory glvDepositData,
        GmxEventUtils.EventLogData memory eventData
    ) external;
}
