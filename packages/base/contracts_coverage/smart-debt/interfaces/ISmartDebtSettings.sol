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
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


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

    /**
     * Struct representing a user's position in a pair
     *
     * @param pairType The type of pair (NONE, SMART_DEBT, or SMART_COLLATERAL)
     * @param pairBytes The unique identifier for the pair
     * @param minExchangeRate The minimum exchange rate for the pair
     * @param maxExchangeRate The maximum exchange rate for the pair
     */
    struct PairPosition {
        PairType pairType;
        bytes32 pairBytes;
        uint256 minExchangeRate;
        uint256 maxExchangeRate;
    }

    /**
     * Struct containing dynamic fee settings
     *
     * @param feeOverride The base fee that will be applied. Default value is from InternalAutoTraderBase
     * @param armageddonThreshold Bid/ask percentage spread for armageddon
     * @param slightThreshold Bid/ask percentage spread for slight
     * @param normalThreshold Bid/ask percentage spread for normal
     * @param feeCliff The report age where the fee will start doubling
     * @param feeCompoundingInterval The interval at which the fee will double
     */
    struct FeeSettings {
        IDolomiteStructs.Decimal feeOverride;
        IDolomiteStructs.Decimal armageddonThreshold;
        IDolomiteStructs.Decimal slightThreshold;
        IDolomiteStructs.Decimal normalThreshold;
        uint256 feeCliff;
        uint256 feeCompoundingInterval;
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
        EnumerableSet.Bytes32Set smartDebtPairs;
        EnumerableSet.Bytes32Set smartCollateralPairs;
        mapping(address => mapping(uint256 => PairPosition)) userToPair;
        mapping(bytes32 => FeeSettings) pairToFeeSettings;
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

    /**
     * Event emitted when a pair's fee settings are set
     *
     * @param pairBytes The unique identifier for the pair
     * @param feeSettings The fee settings
     */
    event PairFeeSettingsSet(bytes32 indexed pairBytes, FeeSettings feeSettings);

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
     * @param _minExchangeRate The minimum exchange rate for the pair
     * @param _maxExchangeRate The maximum exchange rate for the pair
     */
    function userSetPair(
        uint256 _accountNumber,
        PairType _pairType,
        uint256 _marketId1,
        uint256 _marketId2,
        uint256 _minExchangeRate,
        uint256 _maxExchangeRate
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
     * @param _feeSettings The fee settings
     */
    function ownerSetPairFeeSettings(
        uint256 _marketId1,
        uint256 _marketId2,
        FeeSettings memory _feeSettings
    ) external;

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
     * Gets the admin and global fees for a pair
     *
     * @param _pairBytes The unique identifier for the pair
     */
    function pairFees(
        bytes32 _pairBytes
    ) external view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory);

    /**
     * Gets the fee settings for a pair
     *
     * @param _pairBytes The unique identifier for the pair
     */
    function pairFeeSettings(bytes32 _pairBytes) external view returns (FeeSettings memory);
}
