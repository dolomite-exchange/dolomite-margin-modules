// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { GmxEventUtils } from "./GmxEventUtils.sol";
import { GmxDeposit } from "./GmxDeposit.sol";


// @title IDepositCallbackReceiver
// @dev interface for a deposit callback contract
interface IGmxDepositCallbackReceiver {

    // @dev called after a deposit execution
    // @param key the key of the deposit
    // @param deposit the deposit that was executed
    function afterDepositExecution(
        bytes32 _key,
        GmxDeposit.Props memory _deposit,
        GmxEventUtils.EventLogData memory _eventData
    ) external;

    // @dev called after a deposit cancellation
    // @param key the key of the deposit
    // @param deposit the deposit that was cancelled
    function afterDepositCancellation(
        bytes32 _key,
        GmxDeposit.Props memory _deposit,
        GmxEventUtils.EventLogData memory _eventData
    ) external;
}
