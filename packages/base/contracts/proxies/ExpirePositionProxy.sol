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

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IExpirePositionProxy } from "./interfaces/IExpirePositionProxy.sol";


/**
 * @title   ExpirePositionProxy
 * @author  Dolomite
 *
 * Contract that allows governance to expire a user's position
 */
contract ExpirePositionProxy is OnlyDolomiteMargin, IExpirePositionProxy {

    // ============ Constants ============

    bytes32 private constant _FILE = "ExpirePositionProxy";

    address public immutable EXPIRY;

    // ============ Constructor ============

    constructor (address _expiry, address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {
        EXPIRY = _expiry;
    }

    // ============ External Functions ============

    function expirePositions(
        ExpirePositionParams[] memory positions
    ) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 len = positions.length;
        uint256 actionsLen;
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](positions.length);

        for (uint256 i; i < len; ++i) {
            accounts[i] = positions[i].account;
            actionsLen += positions[i].owedMarkets.length;
        }

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](actionsLen);

        uint256 actionsCursor;
        for (uint256 i; i < len; ++i) {
            ExpirePositionParams memory position = positions[i];

            for (uint256 j; j < position.owedMarkets.length; ++j) {
                actions[actionsCursor++] = AccountActionLib.encodeExpirationAction(
                    position.account,
                    /* accountId = */ i,
                    position.owedMarkets[j],
                    address(EXPIRY),
                    /* _expiryTimeDelta = */ position.expirationTimestamp - block.timestamp
                );
            }
        }

        DOLOMITE_MARGIN().operate(accounts, actions);
    }
}
