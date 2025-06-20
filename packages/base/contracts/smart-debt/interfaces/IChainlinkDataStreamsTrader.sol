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

    /**
     * Emitted when a token feed is inserted or updated
     * 
     * @param _token The token address
     * @param _feedId The feed ID
     */
    event TokenFeedInsertedOrUpdated(
        address indexed _token,
        bytes32 indexed _feedId
    );

    // ========================================================
    // ====================== Structs =========================
    // ========================================================

    /**
     * Struct that contains all state variables stored in this contract
     * 
     * @param tokenToFeedIdMap Map of token to feed ID
     * @param feedIdToTokenMap Map of feed ID to token
     * @param tokenToLatestReport Map of token to latest report
     */
    struct ChainlinkDataStreamsTraderStorage {
        mapping(address => bytes32) tokenToFeedIdMap;
        mapping(bytes32 => address) feedIdToTokenMap;
        mapping(address => LatestReport) tokenToLatestReport;
    }

    /**
     * Struct that contains the latest report for a token
     * 
     * @param timestamp The timestamp of the report
     * @param bid The bid price in the report
     * @param ask The ask price in the report
     * @param benchmarkPrice The benchmark price in the report
     */
    struct LatestReport {
        uint64 timestamp;
        uint256 bid;
        uint256 ask;
        uint256 benchmarkPrice;
    }

    /**
     * Struct that contains the report callback data
     * 
     * @dev Copied from Chainlink
     * 
     * @param reportContext The report context
     * @param reportBlob The report blob
     * @param rawRs The raw R values
     * @param rawSs The raw S values
     * @param rawVs The raw V value
     */
    struct ReportCallback {
        bytes32[3] reportContext;
        bytes reportBlob;
        bytes32[] rawRs;
        bytes32[] rawSs;
        bytes32 rawVs;
    }

    /**
     * Struct that contains the data streams report data
     * 
     * @dev Copied from Chainlink
     * 
     * @param feedId The feed ID
     * @param validFromTimestamp The valid from timestamp
     * @param observationsTimestamp The observations timestamp
     * @param nativeFee The native fee
     * @param linkFee The link fee
     * @param expiresAt The expires at timestamp
     * @param benchmarkPrice The benchmark price
     * @param bid The bid price
     * @param ask The ask price
     */
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

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    /**
     * Inserts or updates a token feed. Only callable by dolomite margin owner
     * 
     * @param _token The token
     * @param _feedId The feed ID
     */
    function ownerInsertOrUpdateTokenFeed(
        address _token,
        bytes32 _feedId
    ) external;

    /**
     * Approves LINK to a spender. Only callable by dolomite margin owner
     * 
     * @param _spender The spender of LINK tokens
     * @param _amount The amount to approve
     */
    function ownerApproveLink(
        address _spender,
        uint256 _amount
    ) external;

    /**
     * Withdraws LINK from the contract. Only callable by dolomite margin owner
     * 
     * @param _recipient The recipient of the LINK tokens
     * @param _amount The amount to withdraw
     */
    function ownerWithdrawLink(
        address _recipient,
        uint256 _amount
    ) external;
    
    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    /**
     * Returns the feed ID for a token
     * 
     * @param _token The token address
     * 
     * @return The feed ID
     */
    function tokenToFeedId(
        address _token
    ) external view returns (bytes32);

    /**
     * Returns the token for a feed ID
     * 
     * @param _feedId The feed ID
     * 
     * @return The token address
     */
    function feedIdToToken(
        bytes32 _feedId
    ) external view returns (address);

    /**
     * Returns the latest report for a token
     * 
     * @param _token The token address
     * 
     * @return The latest report
     */
    function getLatestReport(
        address _token
    ) external view returns (LatestReport memory);
}
