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

import { IChronicleScribe } from "../interfaces/IChronicleScribe.sol";


/**
 * @title   TestChronicleScribe
 * @author  Dolomite
 *
 * A test implementation of the Chronicle scribe interface.
 */
contract TestChronicleScribe is IChronicleScribe {

    int256 internal _latestAnswer;
    uint256 internal _lastUpdatedAt;
    int192 internal _minAnswer;
    int192 internal _maxAnswer;
    uint8 internal _decimals;

    constructor() {
        _minAnswer = 1;
        _maxAnswer = 95780971304118053647396689196894323976171195136475135;
    }

    function kiss(address who) external override {}

    function setLatestAnswer(
        int256 __latestAnswer
    ) external {
        _latestAnswer = __latestAnswer;
        _lastUpdatedAt = block.timestamp;
    }

    function setMinAnswer(int192 __minAnswer) external {
        _minAnswer = __minAnswer;
    }

    function setMaxAnswer(int192 __maxAnswer) external {
        _maxAnswer = __maxAnswer;
    }

    function setDecimals(uint8 __decimals) external {
        _decimals = __decimals;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            /* roundId = */ 0,
            _latestAnswer,
            /* startedAt = */ 0,
            _lastUpdatedAt,
            /* answeredInRound = */ 0
        );
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function authed() external view returns (address[] memory) {
        return new address[](0);
    }

    function bud(address /* _who */) external view returns (uint256) {
        return 1;
    }
}
