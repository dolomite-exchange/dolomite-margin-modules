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


/**
 * @title   ISmartDebtSettings
 * @author  Dolomite
 *
 * Interface for managing smart debt settings
 */
interface ISmartDebtSettings {

    /**
     * Enum representing the type of pair configuration
     */
    enum PairType {
        NONE,
        SMART_DEBT,
        SMART_COLLATERAL
    }

    struct PriceRange {
        uint256 minPrice;
        uint256 maxPrice;
    }

    /**
     * Struct representing a user's position in a pair
     * 
     * @param pairType The type of pair (NONE, SMART_DEBT, or SMART_COLLATERAL)
     * @param pairBytes The unique identifier for the pair
     * @param market1MinPrice The minimum price for market 1
     * @param market1MaxPrice The maximum price for market 1
     * @param market2MinPrice The minimum price for market 2
     * @param market2MaxPrice The maximum price for market 2
     */
    struct PairPosition {
        PairType pairType;
        bytes32 pairBytes;
        mapping(uint256 => PriceRange) marketToPriceRange;
    }

    /**
     * Struct containing all storage variables for smart pairs
     * 
     * @param pairToFee Mapping of pair bytes to fee amounts
     * @param smartDebtPairs Set of valid smart debt pairs
     * @param smartCollateralPairs Set of valid smart collateral pairs
     * @param userToPair Mapping of user address and account number to pair position
     */
    struct SmartPairsStorage {
        mapping(bytes32 => uint256) pairToFee;
        EnumerableSet.Bytes32Set smartDebtPairs;
        EnumerableSet.Bytes32Set smartCollateralPairs;
        mapping(address => mapping(uint256 => PairPosition)) userToPair;
    }

    // ========================================================
    // ======================= Events =========================
    // ========================================================

    /**
     * Event emitted when a new smart debt pair is added
     * 
     * @dev The market IDs are sorted in ascending order
     * 
     * @param marketId1 The first market ID of the pair
     * @param marketId2 The second market ID of the pair
     */
    event SmartDebtPairAdded(uint256 indexed marketId1, uint256 indexed marketId2);
    
    /**
     * Event emitted when a smart debt pair is removed
     * 
     * @dev The market IDs are sorted in ascending order
     * 
     * @param marketId1 The first market ID of the pair
     * @param marketId2 The second market ID of the pair
     */
    event SmartDebtPairRemoved(uint256 indexed marketId1, uint256 indexed marketId2);
    
    /**
     * Event emitted when a new smart collateral pair is added
     * 
     * @dev The market IDs are sorted in ascending order
     * 
     * @param marketId1 The first market ID of the pair
     * @param marketId2 The second market ID of the pair
     */
    event SmartCollateralPairAdded(uint256 indexed marketId1, uint256 indexed marketId2);
    
    /**
     * Event emitted when a smart collateral pair is removed
     * 
     * @dev The market IDs are sorted in ascending order
     * 
     * @param marketId1 The first market ID of the pair
     * @param marketId2 The second market ID of the pair
     */
    event SmartCollateralPairRemoved(uint256 indexed marketId1, uint256 indexed marketId2);
    
    /**
     * Event emitted when a user's pair is set
     * 
     * @param user The address of the user
     * @param accountNumber The account number of the user
     * @param pairType The type of pair being set
     * @param pairBytes The unique identifier for the pair
     */
    event UserToPairSet(address indexed user, uint256 indexed accountNumber, PairType pairType, bytes32 pairBytes);

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    /**
     * Sets a user's pair
     * 
     * @param _accountNumber The account number of the user
     * @param _pairType The type of pair being set
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     * @param _market1PriceRange The price range for the first market
     * @param _market2PriceRange The price range for the second market
     */
    function userSetPair(
        uint256 _accountNumber,
        PairType _pairType,
        uint256 _marketId1,
        uint256 _marketId2,
        uint256[] memory _market1PriceRange,
        uint256[] memory _market2PriceRange
    ) external;

    /**
     * Adds a new smart debt pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     */
    function ownerAddSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external;

    /**
     * Removes a smart debt pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     */
    function ownerRemoveSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external;

    /**
     * Adds a new smart collateral pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     */
    function ownerAddSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external;

    /**
     * Removes a smart collateral pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     */
    function ownerRemoveSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external;

    /**
     * Sets the fee for a pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     * @param _fee The fee
     */
    function ownerSetPairFee(uint256 _marketId1, uint256 _marketId2, uint256 _fee) external;

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    /**
     * Checks if a pair is a smart debt pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     */
    function isSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool);

    /**
     * Checks if a pair is a smart collateral pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     */
    function isSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool);

    /**
     * Gets the fee for a pair
     * 
     * @param _marketId1 The first market ID of the pair
     * @param _marketId2 The second market ID of the pair
     */
    function pairFee(uint256 _marketId1, uint256 _marketId2) external view returns (uint256);
}
