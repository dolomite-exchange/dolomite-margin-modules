// SPDX-License-Identifier: Apache 2.0
/*

    Copyright 2022 Dolomite.

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

import { HasLiquidatorRegistry } from "../general/HasLiquidatorRegistry.sol";


/**
 * @title   TestHasLiquidatorRegistry
 * @author  Dolomite
 *
 * Contract for testing HasLiquidatorRegistry
 */
contract TestHasLiquidatorRegistry is HasLiquidatorRegistry {

    // ============ Constructors ============

    constructor(
        address _liquidatorAssetRegistry
    )
        HasLiquidatorRegistry(_liquidatorAssetRegistry)
    { /* solhint-disable-line no-empty-blocks */ }

    // ============ Internal Functions ============

    function validateAssetForLiquidation(
        uint256 _marketId
    )
    external
    requireIsAssetWhitelistedForLiquidation(_marketId)
    view
    returns (bool) {
        return true;
    }

    function validateAssetsForLiquidation(
        uint256[] calldata _marketIds
    )
    external
    requireIsAssetsWhitelistedForLiquidation(_marketIds)
    view
    returns (bool) {
        return true;
    }
}
