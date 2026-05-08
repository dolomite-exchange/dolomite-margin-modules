// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite.

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

import { IAuthorizationBase } from "../../interfaces/IAuthorizationBase.sol";
import { IGenericTraderBase } from "../../interfaces/IGenericTraderBase.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   IExpirePositionProxy
 * @author  Dolomite
 *
 * Proxy for expiring user positions. Only callable by governance
 */
interface IExpirePositionProxy {

    // ============ Structs ============

    struct ExpirePositionParams {
        IDolomiteStructs.AccountInfo account;
        uint256[] owedMarkets;
        uint256 expirationTimestamp;
    }

    function expirePositions(
        ExpirePositionParams[] memory positions
    ) external;
}
