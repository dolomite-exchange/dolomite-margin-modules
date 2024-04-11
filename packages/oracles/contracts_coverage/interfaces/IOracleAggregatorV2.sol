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
 * @title   IOracleAggregatorV2.sol
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that aggregates all oracles into one contract
 */
interface IOracleAggregatorV2 is IDolomitePriceOracle {

    struct TokenInfo {
        OracleInfo[] oracleInfos;
        uint8 decimals;
        address token;
    }

    struct OracleInfo {
        address oracle;
        address tokenPair;
        uint256 weight;
    }

    // ============ Events ============

    event TokenInsertedOrUpdated(
        TokenInfo info
    );

    // ============ Admin Functions ============

    /**
     * @dev Insert or update a token in the oracle. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _info    The info for the token
     */
    function ownerInsertOrUpdateToken(
        TokenInfo memory _info
    )
    external;

    // ============ Getter Functions ============

    function getDecimalsByToken(address _token) external view returns (uint8);

    function getTokenInfo(address _token) external view returns (TokenInfo memory);

    function getOraclesByToken(address _token) external view returns (OracleInfo[] memory);
}
