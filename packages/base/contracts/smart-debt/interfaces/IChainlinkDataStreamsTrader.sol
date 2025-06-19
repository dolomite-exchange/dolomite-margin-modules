// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2023 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;


/**
 * @title   IChainlinkDataStreamsTrader
 * @author  Dolomite
 *
 * Interface for the ChainlinkDataStreamsTrader contract
 */
interface IChainlinkDataStreamsTrader {

    // ========================================================
    // ====================== Structs =========================
    // ========================================================

    struct ChainlinkDataStreamsTraderStorage {
        mapping(address => bytes32) tokenToFeedIdMap;
        mapping(bytes32 => address) feedIdToTokenMap;
        mapping(address => LatestReport) tokenToLatestReport;
    }

    struct LatestReport {
        uint64 timestamp;
        uint256 bid;
        uint256 ask;
        uint256 benchmarkPrice;
    }

    struct ReportCallback {
        bytes32[3] reportContext;
        bytes reportBlob;
        bytes32[] rawRs;
        bytes32[] rawSs;
        bytes32 rawVs;
    }

    struct ReportDataV3 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        int192 benchmarkPrice;
        int192 bid;
        int192 ask;
    }
}
