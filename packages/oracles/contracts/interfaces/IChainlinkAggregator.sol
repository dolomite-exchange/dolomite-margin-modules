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

import { IChainlinkAccessControlAggregator } from "./IChainlinkAccessControlAggregator.sol";


/**
 * @title   IChainlinkAggregator
 * @author  Dolomite
 *
 * Gets the latest price from the Chainlink Oracle Network. Amount of decimals depends on the base.
 */
interface IChainlinkAggregator {

    function aggregator() external view returns (IChainlinkAccessControlAggregator);

    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestRoundData()
    external
    view
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
