// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2025 Dolomite.

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
 * @title   IChainsightOracle
 * @author  Dolomite
 *
 * Gets the latest price from the Chainsight oracle. Amount of decimals depends on the base.
 */
interface IChainsightOracle {

    function readAsUint256WithTimestamp(
        address sender,
        bytes32 key
    ) external view returns (uint256, uint64);
}
