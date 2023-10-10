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

import { IOARB } from "../interfaces/liquidityMining/IOARB.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";


/**
 * @title   OARBStorageVault
 * @author  Dolomite
 *
 * oARB Storage Vault contract that mints oARB when called by the emitter contracts
 */
contract OARBStorageVault is OnlyDolomiteMargin {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "oARBStorageVault";

    IOARB public oARB;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        IOARB _oARB
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        oARB = _oARB;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    // @follow-up Is global operator the appropriate restriction here?
    function pullTokensFromVault(uint256 _amount) external onlyDolomiteMarginGlobalOperator(msg.sender) {
        oARB.mint(_amount);
        oARB.transfer(msg.sender, _amount);
    }
}
