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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Mintable } from "./interfaces/IERC20Mintable.sol";


/**
 * @title   MintableStorageVault.sol
 * @author  Dolomite
 *
 * OARB Storage Vault contract that mints oARB when pullTokensFromVault is called
 * WARNING: THIS CODE HAS NOT BEEN THOROUGHLY TESTED AND IS NOT PRODUCTION READY
 */
contract MintableStorageVault is OnlyDolomiteMargin {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "oARBStorageVault";

    IERC20Mintable public oARB;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        IERC20Mintable _oARB
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        oARB = _oARB;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function pullTokensFromVault(uint256 _amount) external onlyDolomiteMarginGlobalOperator(msg.sender) {
        oARB.mint(_amount);
        IERC20(address(oARB)).transfer(msg.sender, _amount);
    }
}
