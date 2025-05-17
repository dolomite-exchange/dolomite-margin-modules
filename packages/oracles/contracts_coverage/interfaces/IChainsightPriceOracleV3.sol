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
 * @title   IChainsightPriceOracleV3
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that makes Chainsight prices compatible with the protocol.
 */
interface IChainsightPriceOracleV3 is IDolomitePriceOracle {

    // ============ Events ============

    event StalenessDurationUpdated(uint256 stalenessDuration);
    event ChainsightOracleUpdated(address indexed chainsightOracle);
    event ChainsightSenderUpdated(address indexed chainsightSender);
    event TokenInsertedOrUpdated(
        address indexed token,
        bytes32 key
    );

    // ============ Admin Functions ============

    /**
     * @dev Sets the new `stalenessThreshold`. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _stalenessThreshold  The duration of time that must pass before a price is considered stale from a
     *                              Chronicle Scribe
     */
    function ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    ) external;

    /**
     * @dev Insert or update a token in the oracle. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _token               The token whose Chainsight key should be inserted or updated
     * @param  _key                 The Chainsight key that corresponds with this token
     * @param  _invertPrice         True if should invert the price received from Chainsight
     */
    function ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _key,
        bool _invertPrice
    ) external;

    function ownerSetChainsightOracle(
        address _chainsightOracle
    ) external;

    function ownerSetChainsightSender(
        address _chainsightSender
    ) external;

    // ============ Getter Functions ============

    /**
     *
     * @param  _token  The token whose Chainsight key should be retrieved
     * @return         The Chainsight key that corresponds with this token
     */
    function getKeyByToken(address _token) external view returns (bytes32);

    /**
     *
     * @param  _token           The token whose token pair should be retrieved
     * @return _invertPrice     True if should invert the price received from Chainsight
     */
    function getInvertPriceByToken(address _token) external view returns (bool _invertPrice);

    /**
     * @return The duration of time that must pass before a price is considered stale from a Chainsight Oracle
     */
    function stalenessThreshold() external view returns (uint256);
}
