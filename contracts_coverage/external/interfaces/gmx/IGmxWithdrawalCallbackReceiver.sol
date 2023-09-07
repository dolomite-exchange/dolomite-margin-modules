// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { GmxEventUtils } from "./GmxEventUtils.sol";
import { GmxWithdrawal } from "./GmxWithdrawal.sol";


// @title IWithdrawalCallbackReceiver
// @dev interface for a withdrawal callback contract
interface IGmxWithdrawalCallbackReceiver {

    // @dev called after a withdrawal execution
    // @param key the key of the withdrawal
    // @param withdrawal the withdrawal that was executed
    function afterWithdrawalExecution(
        bytes32 _key,
        GmxWithdrawal.Props memory _withdrawal,
        GmxEventUtils.EventLogData memory _eventData
    ) external;

    // @dev called after a withdrawal cancellation
    // @param key the key of the withdrawal
    // @param withdrawal the withdrawal that was cancelled
    function afterWithdrawalCancellation(
        bytes32 _key,
        GmxWithdrawal.Props memory _withdrawal,
        GmxEventUtils.EventLogData memory _eventData
    ) external;
}
