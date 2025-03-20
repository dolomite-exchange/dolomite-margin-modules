// SPDX-License-Identifier: GPL-3.0-or-later
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

import { IGenericTraderBase } from "../../interfaces/IGenericTraderBase.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   ILiquidatorProxyV5
 * @author  Dolomite
 *
 * Interface for liquidating positions via the LiquidatorProxyV5
 */
interface ILiquidatorProxyV5 {

    // ============ Enums ============

    struct LiquidateParams {
        IDolomiteStructs.AccountInfo solidAccount;
        IDolomiteStructs.AccountInfo liquidAccount;
        uint256[] marketIdsPath;
        uint256 inputAmountWei;
        uint256 minOutputAmountWei;
        IGenericTraderBase.TraderParam[] tradersPath;
        IDolomiteStructs.AccountInfo[] makerAccounts;
        uint256 expirationTimestamp;
        bool withdrawAllReward;
    }

    function initialize() external;

    function liquidate(
        LiquidateParams memory _liquidateParams
    ) external;
}
