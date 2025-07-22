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
 * @title   IERC4626PriceOracle
 * @author  Dolomite
 *
 * An interface of IDolomitePriceOracle that makes ERC4626 prices compatible with the protocol.
 */
interface IERC4626PriceOracle is IDolomitePriceOracle {

    // ============ Events ============

    event TokenInsertedOrUpdated(
        address indexed token,
        bool isSupported
    );

    struct TokenInfo {
        address vault;
        uint8 vaultDecimals;
        address asset;
        uint8 assetDecimals;
    }

    // ============ Admin Functions ============

    /**
     * @dev Insert or update a token in the oracle. This function can only be called by the owner of DolomiteMargin.
     *
     * @param  _token       The token whose Chainlink aggregator should be inserted or updated
     * @param  _isSupported True if the token is supported
     */
    function ownerInsertOrUpdateToken(
        address _token,
        bool _isSupported
    )
    external;
}
