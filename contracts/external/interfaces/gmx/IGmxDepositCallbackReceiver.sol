// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.9;

import { EventUtils } from "./GmxEventUtils.sol";
import { Deposit } from "./GmxDeposit.sol";

// @title IDepositCallbackReceiver
// @dev interface for a deposit callback contract
interface IGmxDepositCallbackReceiver {
    // @dev called after a deposit execution
    // @param key the key of the deposit
    // @param deposit the deposit that was executed
    function afterDepositExecution(
        bytes32 key,
        Deposit.Props memory deposit,
        EventUtils.EventLogData memory eventData
    ) external;

    // @dev called after a deposit cancellation
    // @param key the key of the deposit
    // @param deposit the deposit that was cancelled
    function afterDepositCancellation(bytes32 key,
        Deposit.Props memory deposit,
        EventUtils.EventLogData memory eventData
    ) external;
}