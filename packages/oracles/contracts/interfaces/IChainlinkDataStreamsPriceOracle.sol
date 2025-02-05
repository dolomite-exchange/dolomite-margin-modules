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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length


/**
 * @title   IChainlinkDataStreamsPriceOracle
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that makes Chainlink datastream prices compatible with the protocol.
 */
interface IChainlinkDataStreamsPriceOracle is IDolomitePriceOracle {

    // ========================================================
    // ====================== Structs =========================
    // ========================================================

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


    // ============ Events ============

    event StalenessDurationUpdated(uint256 stalenessDuration);
    event TokenInsertedOrUpdated(
        address indexed token,
        bytes32 indexed feedId
    );

    // ============ Public Functions ============

    function postPrices(
        bytes[] memory _reports
    ) external;

    // ============ Admin Functions ============

    /**
     * @dev Sets the new `stalenessThreshold`. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _stalenessThreshold  The duration of time that must pass before a price is considered stale from a
     *                              Chainlink Aggregator
     */
    function ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    )
    external;

    /**
     * @dev Insert or update a token in the oracle. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _token               The token whose Chainlink aggregator should be inserted or updated
     * @param  _feedId              The Chainlink data stream ID
     */
    function ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _feedId
    )
    external;

    /**
     * @dev Approve the spender to spend the token. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _spender  The address of the spender
     * @param  _amount   The amount of tokens to approve
     */
    function ownerApproveLink(
        address _spender,
        uint256 _amount
    )
    external;

    /**
     * @dev Withdraw the tokens. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _recipient  The address of the recipient
     * @param  _amount     The amount of tokens to withdraw
     */
    function ownerWithdrawLink(
        address _recipient,
        uint256 _amount
    )
    external;

    // ============ Getter Functions ============

    /**
     * @return The duration of time that must pass before a price is considered stale from a Chainlink Aggregator
     */
    function stalenessThreshold() external view returns (uint256);

    /**
     * @return The Chainlink data stream ID for the given token
     */
    function tokenToFeedId(
        address _token
    ) external view returns (bytes32);

    /**
     * @return The token for the given Chainlink data stream ID
     */
    function feedIdToToken(
        bytes32 _feedId
    ) external view returns (address);
}
