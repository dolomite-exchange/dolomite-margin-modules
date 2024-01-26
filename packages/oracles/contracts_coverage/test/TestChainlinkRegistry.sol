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

import { IChainlinkRegistry } from "../interfaces/IChainlinkRegistry.sol";


/**
 * @title   TestChainlinkRegistry
 * @author  Dolomite
 *
 * A test implementation of the Chainlink registry interface.
 */
contract TestChainlinkRegistry is IChainlinkRegistry {

    address public forwarder;

    constructor(address _forwarder) {
        forwarder = _forwarder;
    }

    function getForwarder(
        uint256 /* _upkeepId */
    ) external view returns (address) {
        return forwarder;
    }
}
