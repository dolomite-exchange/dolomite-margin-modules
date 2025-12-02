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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length


/**
 * @title   IConstantPriceOracle
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that returns a constant price for a given token.
 */
interface IConstantPriceOracle is IDolomitePriceOracle {

    // ============ Events ============

    event TokenPriceSet(
        address indexed token,
        uint256 price
    );

    // ============ Admin Functions ============

    /**
     * Sets the price for a token.
     * 
     * @dev The price NEEDS to be in 36 - token decimals format.
     * 
     * @param  _token   The token to set the price for.
     * @param  _price   The price to set for the token.
     */
    function ownerSetTokenPrice(address _token, uint256 _price) external;
}
