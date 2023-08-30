// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./EventUtils.sol";

interface IEventEmitter {
    event EventLog(
        address msgSender,
        string eventName,
        string indexed eventNameHash,
        EventUtils.EventLogData eventData
    );
    event EventLog1(
        address msgSender,
        string eventName,
        string indexed eventNameHash,
        bytes32 indexed topic1,
        EventUtils.EventLogData eventData
    );
}
