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

import { IDolomiteAutoTrader } from "../../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   IInternalAutoTraderBase
 * @author  Dolomite
 *
 * Base interface for performing internal trades
 */
interface IInternalAutoTraderBase is IDolomiteAutoTrader {

    // ========================================================
    // ================== Structs Functions ==================
    // ========================================================

    struct InternalTradeParams {
        IDolomiteStructs.AccountInfo makerAccount;
        uint256 makerAccountId;
        uint256 amount;
        uint256 minOutputAmount;
    }

    struct InternalTraderBaseStorage {
        bool tradeEnabled;
        uint256 globalFee;
        uint256 adminFee;
    }

    struct CreateActionsForInternalTradeParams {
        uint256 takerAccountId;
        IDolomiteStructs.AccountInfo takerAccount;
        uint256 feeAccountId;
        IDolomiteStructs.AccountInfo feeAccount;
        uint256 inputMarketId;
        uint256 outputMarketId;
        uint256 inputAmountWei;
        InternalTradeParams[] trades;
        bytes extraData;
    }

    // ========================================================
    // ================== Events Functions ==================
    // ========================================================

    event GlobalFeeSet(uint256 indexed globalFee);
    event AdminFeeSet(uint256 indexed adminFee);
    event PairFeeSet(bytes32 indexed pairBytes, uint256 indexed fee);

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function ownerSetGlobalFee(uint256 _globalFee) external;
    function ownerSetAdminFee(uint256 _adminFee) external;

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) external view returns (IDolomiteStructs.ActionArgs[] memory);

    function actionsLength(InternalTradeParams[] calldata _trades) external view returns (uint256);
}
