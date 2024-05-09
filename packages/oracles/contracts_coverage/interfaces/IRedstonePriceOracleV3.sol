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
import { IChainlinkAggregator } from "./IChainlinkAggregator.sol";


/**
 * @title   IRedstonePriceOracleV3
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that makes Redstone prices compatible with the protocol.
 */
interface IRedstonePriceOracleV3 is IDolomitePriceOracle {

    // ============ Events ============

    event StalenessDurationUpdated(uint256 stalenessDuration);

    event TokenInsertedOrUpdated(
        address indexed token,
        address indexed aggregator
    );

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
     * @param  _token                   The token whose Chainlink aggregator should be inserted or updated
     * @param  _chainlinkAggregator     The Chainlink aggregator that corresponds with this token
     * @param  _invertPrice             True if should invert the price received from Chainlink
     */
    function ownerInsertOrUpdateOracleToken(
        address _token,
        address _chainlinkAggregator,
        bool _invertPrice
    )
    external;

    // ============ Getter Functions ============

    /**
     *
     * @param  _token  The token whose Chainlink aggregator should be retrieved
     * @return         The aggregator that corresponds with this token
     */
    function getAggregatorByToken(address _token) external view returns (IChainlinkAggregator);

    /**
     *
     * @param  _token       The token whose token pair should be retrieved
     * @return _invertPrice True if price from Chainlink should be inverted
     */
    function getInvertPriceByToken(address _token) external view returns (bool _invertPrice);

    /**
     * @return The duration of time that must pass before a price is considered stale from a Chainlink Aggregator
     */
    function stalenessThreshold() external view returns (uint256);
}
