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

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";

/**
 * @title   TestContractAccount
 * @author  Dolomite
 *
 * Test contract
 */
contract TestContractAccount {

    error Foo(uint256 a, uint256 b, uint256 c);

    function onLiquidate(
        uint256 /* _accountNumber */,
        uint256 /* _heldMarketId */,
        IDolomiteStructs.Wei calldata /* _heldDeltaWei */,
        uint256 /* _owedMarketId */,
        IDolomiteStructs.Wei calldata /* _owedDeltaWei */
    ) external {
        revert Foo(type(uint256).max, type(uint256).max, type(uint256).max);
    }

    function onInternalBalanceChange(
        uint256 /* _primaryAccountNumber */,
        IDolomiteStructs.AccountInfo calldata /* _secondaryAccount */,
        uint256 /* _primaryMarketId */,
        IDolomiteStructs.Wei calldata /* _primaryDeltaWei */,
        uint256 /* _secondaryMarketId */,
        IDolomiteStructs.Wei calldata /* _secondaryDeltaWei */
    ) external {
        revert Foo(type(uint256).max, type(uint256).max, type(uint256).max);
    }
}
