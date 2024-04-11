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
import { IChainlinkPriceOracleV3 } from "./IChainlinkPriceOracleV3.sol";


/**
 * @title   IOracleAggregatorV1
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that aggregates all oracles into one contract
 */
interface IOracleAggregatorV1 is IDolomitePriceOracle {

    // ============ Events ============

    event TokenInsertedOrUpdated(
        address indexed token,
        address indexed oracle,
        address indexed tokenPair
    );

    // ============ Admin Functions ============

    /**
     * @dev Insert or update a token in the oracle. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _token   The token whose Chainlink aggregator should be inserted or updated
     * @param  _oracle  The oracle for the token
     */
    function ownerInsertOrUpdateOracle(
        address _token,
        address _oracle,
        address _tokenPair
    )
    external;

    // ============ Getter Functions ============

    /**
     *
     * @param  _token  The token whose oracle should be retrieved
     * @return         The oracle that corresponds with this token
     */
    function getOracleByToken(address _token) external view returns (IChainlinkPriceOracleV3);

    /**
     *
     * @param  _token  The token whose oracle should be retrieved
     * @return         The tokenPair that corresponds with this token
     */
    function getTokenPairByToken(address _token) external view returns (address);
}
