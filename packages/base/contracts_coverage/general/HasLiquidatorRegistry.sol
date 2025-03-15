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

import { ILiquidatorAssetRegistry } from "../interfaces/ILiquidatorAssetRegistry.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   HasLiquidatorRegistry
 * @author  Dolomite
 *
 * Contract for storing and referring to the liquidator asset registry for whitelisting/handling liquidations
 */
abstract contract HasLiquidatorRegistry {

    // ============ Constants ============

    bytes32 private constant _FILE = "HasLiquidatorRegistry";

    // ============ Storage ============

    ILiquidatorAssetRegistry public immutable LIQUIDATOR_ASSET_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Modifiers ============

    modifier requireIsAssetWhitelistedForLiquidation(uint256 _marketId) {
        _validateAssetForLiquidation(_marketId);
        _;
    }

    modifier requireIsAssetsWhitelistedForLiquidation(uint256[] memory _marketIds) {
        _validateAssetsForLiquidation(_marketIds);
        _;
    }

    // ============ Constructors ============

    constructor(address _liquidatorAssetRegistry) {
        LIQUIDATOR_ASSET_REGISTRY = ILiquidatorAssetRegistry(_liquidatorAssetRegistry);
    }

    // ============ Internal Functions ============

    function _validateAssetsForLiquidation(uint256[] memory _marketIds) internal view {
        for (uint256 i = 0; i < _marketIds.length; i++) {
            _validateAssetForLiquidation(_marketIds[i]);
        }
    }

    function _validateAssetForLiquidation(uint256 _marketId) internal view {
        bool whitelistedForLiquidation = LIQUIDATOR_ASSET_REGISTRY.isAssetWhitelistedForLiquidation(
            _marketId,
            address(this)
        );

        if (!whitelistedForLiquidation) {
            if (LIQUIDATOR_ASSET_REGISTRY.isAssetWhitelistedForLiquidation(_marketId, msg.sender)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                LIQUIDATOR_ASSET_REGISTRY.isAssetWhitelistedForLiquidation(_marketId, msg.sender),
                _FILE,
                "Asset not whitelisted",
                _marketId
            );
        }
    }
}
