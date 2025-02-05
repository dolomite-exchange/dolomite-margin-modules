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
import { IInternalAutoTraderBase } from "./IInternalAutoTraderBase.sol";


/**
 * @title   ISmartDebtAutoTrader
 * @author  Dolomite
 *
 * Interface for performing internal trades using smart debt
 */
interface ISmartDebtAutoTrader is IInternalAutoTraderBase {

    enum PairType {
        NONE,
        SMART_DEBT,
        SMART_COLLATERAL
    }

    struct PairPosition {
        PairType pairType;
        bytes32 pairBytes;
    }

    struct SmartPairsStorage {
        mapping(bytes32 => uint256) pairToFee;
        EnumerableSet.Bytes32Set smartDebtPairs;
        EnumerableSet.Bytes32Set smartCollateralPairs;
        mapping(address => mapping(uint256 => PairPosition)) userToPair;
    }

    // ========================================================
    // ================== Events Functions ==================
    // ========================================================

    event SmartDebtPairAdded(uint256 indexed marketId1, uint256 indexed marketId2);
    event SmartDebtPairRemoved(uint256 indexed marketId1, uint256 indexed marketId2);
    event SmartCollateralPairAdded(uint256 indexed marketId1, uint256 indexed marketId2);
    event SmartCollateralPairRemoved(uint256 indexed marketId1, uint256 indexed marketId2);
    event UserToPairSet(address indexed user, uint256 indexed accountNumber, PairType pairType, bytes32 pairBytes);

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function userSetPair(uint256 _accountNumber, PairType _pairType, uint256 _marketId1, uint256 _marketId2) external;

    function ownerAddSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external;
    function ownerRemoveSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external;
    function ownerAddSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external;
    function ownerRemoveSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external;

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function isSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool);
    function isSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool);

    function userToPair(address _user, uint256 _accountNumber) external view returns (PairPosition memory);
}
