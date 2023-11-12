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

import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";


/**
 * @title   ITWAPPriceOracle
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that uses TWAP to get prices compatible with the protocol
 */
interface ITWAPPriceOracle is IDolomitePriceOracle {

    // ============ Events ============

    event ObservationIntervalUpdated(uint256 observationInterval);
    event PairAdded(address pair);
    event PairRemoved(address pair);

    // ============ Admin Functions ============

    /**
     * @dev Sets the new `stalenessThreshold`. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _observationInterval  The duration of time that must pass before a price is considered stale from a
     *                              Chainlink Aggregator
     */
    function ownerSetObservationInterval(
        uint32 _observationInterval
    )
    external;

    // ============ Getter Functions ============

    /**
    /**
     * @return The duration of time that must pass before a price is considered stale from a Chainlink Aggregator
     */
    function observationInterval() external view returns (uint32);
}
