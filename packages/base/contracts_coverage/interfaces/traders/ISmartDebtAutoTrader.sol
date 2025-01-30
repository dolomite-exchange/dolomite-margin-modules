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

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteAutoTrader } from "../../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   ISmartDebtAutoTrader
 * @author  Dolomite
 *
 * Interface for performing internal trades using smart debt
 */
interface ISmartDebtAutoTrader is IDolomiteAutoTrader {

    // ========================================================
    // ================== Structs Functions ==================
    // ========================================================

    enum PairType {
        NONE,
        SMART_DEBT,
        SMART_COLLATERAL
    }

    struct PairPosition {
        PairType pairType;
        bytes32 pairBytes;
    }

    struct SmartAssetSwapParams {
        address user;
        uint256 accountNumber;
        uint256 amount;
        uint256 minOutputAmount;
    }

    struct SmartPairsStorage {
        bool tradeEnabled;
        uint256 globalFee;
        uint256 adminFee;

        mapping(bytes32 => uint256) pairToFee;
        EnumerableSet.Bytes32Set smartDebtPairs;
        EnumerableSet.Bytes32Set smartCollateralPairs;
        mapping(address => mapping(uint256 => PairPosition)) userToPair;
    }

    struct CreateActionsForInternalTradeParams {
        uint256 inputMarketId;
        uint256 outputMarketId;
        uint256 inputAmountWei;
        uint256 feeAccountId;
        uint256 makerAccountStartId;
        SmartAssetSwapParams[] swaps;
    }

    // ========================================================
    // ================== Events Functions ==================
    // ========================================================

    event SmartDebtPairAdded(uint256 indexed marketId1, uint256 indexed marketId2);
    event SmartDebtPairRemoved(uint256 indexed marketId1, uint256 indexed marketId2);
    event SmartCollateralPairAdded(uint256 indexed marketId1, uint256 indexed marketId2);
    event SmartCollateralPairRemoved(uint256 indexed marketId1, uint256 indexed marketId2);
    event UserToPairSet(address indexed user, uint256 indexed accountNumber, PairType pairType, bytes32 pairBytes);

    event GlobalFeeSet(uint256 indexed globalFee);
    event AdminFeeSet(uint256 indexed adminFee);
    event PairFeeSet(bytes32 indexed pairBytes, uint256 indexed fee);

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function userSetPair(uint256 _accountNumber, PairType _pairType, uint256 _marketId1, uint256 _marketId2) external;

    function ownerAddSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external;
    function ownerRemoveSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external;
    function ownerAddSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external;
    function ownerRemoveSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external;

    function ownerSetGlobalFee(uint256 _globalFee) external;
    function ownerSetAdminFee(uint256 _adminFee) external;
    function ownerSetPairFee(uint256 _marketId1, uint256 _marketId2, uint256 _fee) external;

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) external view returns (IDolomiteStructs.ActionArgs[] memory);

    function actionsLength(uint256 _swaps) external view returns (uint256);

    function isSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool);
    function isSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool);

    function userToPair(address _user, uint256 _accountNumber) external view returns (PairPosition memory);
}
