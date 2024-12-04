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

import { IBexPriceQuery } from "../interfaces/IBexPriceQuery.sol";


/**
 * @title   TestBexPriceOracle
 * @author  Dolomite
 *
 * A test contract for getting prices (UNSAFELY) from the BEX DEX on Berachain Bartio
 */
contract TestBexPriceOracle {

    IBexPriceQuery public constant QUERY = IBexPriceQuery(0x8685CE9Db06D40CBa73e3d09e6868FE476B5dC89);
    address public constant HONEY = 0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03;

    uint256 public constant LOW_FEE_TIER = 36_000;
    uint256 public constant MEDIUM_FEE_TIER = 36_001;
    uint256 public constant HIGH_FEE_TIER = 36_002;

    function getPrice(address _token) external view returns (uint128) {
        if (_token == HONEY) {
            return 1 ether;
        }

        return QUERY.queryPrice(_token, HONEY, LOW_FEE_TIER);
    }
}
