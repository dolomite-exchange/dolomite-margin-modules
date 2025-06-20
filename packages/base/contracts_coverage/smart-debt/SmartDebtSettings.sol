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
import { InternalAutoTraderBase } from "./InternalAutoTraderBase.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { ISmartDebtSettings } from "./interfaces/ISmartDebtSettings.sol";


/**
 * @title   SmartDebtSettings
 * @author  Dolomite
 *
 * Contract for managing smart debt settings
 */
abstract contract SmartDebtSettings is InternalAutoTraderBase, ISmartDebtSettings {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "SmartDebtPairSettings";
    bytes32 private constant _SMART_PAIRS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.smartPairsStorage")) - 1); // solhint-disable-line max-line-length
    uint256 private constant _36_DECIMALS_FACTOR = 10 ** 36;

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    /// @inheritdoc ISmartDebtSettings
    function userSetPair(
        uint256 _accountNumber,
        PairType _pairType,
        uint256 _marketId1,
        uint256 _marketId2,
        uint256 _minExchangeRate,
        uint256 _maxExchangeRate
    ) external {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();

        // Remove pair
        if (_pairType == PairType.NONE) {
            delete smartPairsStorage.userToPair[msg.sender][_accountNumber];
            emit UserToPairSet(msg.sender, _accountNumber, _pairType, bytes32(0));
            return;
        }

        // Check valid pair
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);
        if (_pairType == PairType.SMART_DEBT) {
            if (smartPairsStorage.smartDebtPairs.contains(pairBytes)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                smartPairsStorage.smartDebtPairs.contains(pairBytes),
                _FILE,
                "Pair does not exist"
            );
        } else if (_pairType == PairType.SMART_COLLATERAL) {
            if (smartPairsStorage.smartCollateralPairs.contains(pairBytes)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                smartPairsStorage.smartCollateralPairs.contains(pairBytes),
                _FILE,
                "Pair does not exist"
            );
        } else {
            revert("Invalid pair type");
        }

        // Set pair
        PairPosition storage userPair = smartPairsStorage.userToPair[msg.sender][_accountNumber];
        userPair.pairType = _pairType;
        userPair.pairBytes = pairBytes;
        userPair.minExchangeRate = _minExchangeRate;
        userPair.maxExchangeRate = _maxExchangeRate;

        emit UserToPairSet(msg.sender, _accountNumber, _pairType, pairBytes);
    }

    // ========================================================
    // ==================== Admin Functions ===================
    // ========================================================

    /// @inheritdoc ISmartDebtSettings
    function ownerAddSmartDebtPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerAddSmartDebtPair(_marketId1, _marketId2);
    }

    /// @inheritdoc ISmartDebtSettings
    function ownerRemoveSmartDebtPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerRemoveSmartDebtPair(_marketId1, _marketId2);
    }

    /// @inheritdoc ISmartDebtSettings
    function ownerAddSmartCollateralPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerAddSmartCollateralPair(_marketId1, _marketId2);
    }

    /// @inheritdoc ISmartDebtSettings
    function ownerRemoveSmartCollateralPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerRemoveSmartCollateralPair(_marketId1, _marketId2);
    }

    /// @inheritdoc ISmartDebtSettings
    function ownerSetPairFeeSettings(
        uint256 _marketId1,
        uint256 _marketId2,
        FeeSettings memory _feeSettings
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPairFeeSettings(_marketId1, _marketId2, _feeSettings);
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    /// @inheritdoc ISmartDebtSettings
    function isSmartDebtPair(uint256 _marketId1, uint256 _marketId2) public view returns (bool) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);
        return smartPairsStorage.smartDebtPairs.contains(pairBytes);
    }

    /// @inheritdoc ISmartDebtSettings
    function isSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) public view returns (bool) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);
        return smartPairsStorage.smartCollateralPairs.contains(pairBytes);
    }

    /// @inheritdoc ISmartDebtSettings
    function pairFees(
        bytes32 _pairBytes
    ) public view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        (IDolomiteStructs.Decimal memory adminFee, IDolomiteStructs.Decimal memory globalFee) = super._getFees();

        SmartPairsStorage storage $ = _getSmartPairsStorage();
        IDolomiteStructs.Decimal memory pairFeeOverride = $.pairToFeeSettings[_pairBytes].feeOverride;
        return (adminFee, pairFeeOverride.value == 0 ? globalFee : pairFeeOverride);
    }

    /// @inheritdoc ISmartDebtSettings
    function pairFeeSettings(bytes32 _pairBytes) public view returns (FeeSettings memory) {
        return _getSmartPairsStorage().pairToFeeSettings[_pairBytes];
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    /**
     * Adds a smart debt pair
     *
     * @dev The function will automatically sort the market IDs
     *
     * @param _marketId1 One market id in the pair
     * @param _marketId2 Other market id in the pair
     */
    function _ownerAddSmartDebtPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);

        bool res = smartPairsStorage.smartDebtPairs.add(pairBytes);
        if (res) { /* FOR COVERAGE TESTING */ }
        Require.that(
            res,
            _FILE,
            "Pair already exists"
        );
        emit SmartDebtPairAdded(_marketId1, _marketId2);
    }

    /**
     * Adds a smart collateral pair
     *
     * @dev The function will automatically sort the market IDs
     *
     * @param _marketId1 One market id in the pair
     * @param _marketId2 Other market id in the pair
     */
    function _ownerAddSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);

        bool wasAdded = smartPairsStorage.smartCollateralPairs.add(pairBytes);
        if (wasAdded) { /* FOR COVERAGE TESTING */ }
        Require.that(
            wasAdded,
            _FILE,
            "Pair already exists"
        );
        emit SmartCollateralPairAdded(_marketId1, _marketId2);
    }

    /**
     * Removes a smart debt pair
     *
     * @param _marketId1 One market id in the pair
     * @param _marketId2 Other market id in the pair
     */
    function _ownerRemoveSmartDebtPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);

        bool wasRemoved = smartPairsStorage.smartDebtPairs.remove(pairBytes);
        if (wasRemoved) { /* FOR COVERAGE TESTING */ }
        Require.that(
            wasRemoved,
            _FILE,
            "Pair does not exist"
        );
        emit SmartDebtPairRemoved(_marketId1, _marketId2);
    }

    /**
     * Removes a smart collateral pair
     *
     * @param _marketId1 One market id in the pair
     * @param _marketId2 Other market id in the pair
     */
    function _ownerRemoveSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);

        bool res = smartPairsStorage.smartCollateralPairs.remove(pairBytes);
        if (res) { /* FOR COVERAGE TESTING */ }
        Require.that(
            res,
            _FILE,
            "Pair does not exist"
        );
        emit SmartCollateralPairRemoved(_marketId1, _marketId2);
    }

    /**
     * Sets the fee settings for a pair
     *
     * @param _marketId1 One market id in the pair
     * @param _marketId2 Other market id in the pair
     * @param _feeSettings The fee settings
     */
    function _ownerSetPairFeeSettings(
        uint256 _marketId1,
        uint256 _marketId2,
        FeeSettings memory _feeSettings
    ) internal {
        bytes32 pairBytes = _getPairBytes(_marketId1, _marketId2);
        _getSmartPairsStorage().pairToFeeSettings[pairBytes] = _feeSettings;
        emit PairFeeSettingsSet(pairBytes, _feeSettings);
    }

    /**
     * Gets the pair hash and sorts the market IDs
     *
     * @dev Pairbytes is stored as the hash of the sorted market IDs
     * @dev This function will automatically sort the market IDs
     *
     * @param _marketId1 One market id in the pair
     * @param _marketId2 Other market id in the pair
     *
     * @return pairBytes The hash that corresponds to the specific pair
     */
    function _getPairBytes(
        uint256 _marketId1,
        uint256 _marketId2
    ) internal pure returns (bytes32) {
        if (_marketId1 != _marketId2) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _marketId1 != _marketId2,
            _FILE,
            "Market IDs must be different"
        );

        if (_marketId1 < _marketId2) {
            return (keccak256(abi.encode(_marketId1, _marketId2)));
        } else {
            return (keccak256(abi.encode(_marketId2, _marketId1)));
        }
    }

    /**
     * Gets the pair position for a user and account number
     *
     * @param _user The user
     * @param _accountNumber The account number
     *
     * @return The pair position
     */
    function _userToPair(address _user, uint256 _accountNumber) internal view returns (PairPosition storage) {
        return _getSmartPairsStorage().userToPair[_user][_accountNumber];
    }

    /**
     * Gets the smart pairs storage
     *
     * @return smartPairsStorage The smart pairs storage
     */
    function _getSmartPairsStorage() internal pure returns (SmartPairsStorage storage smartPairsStorage) {
        bytes32 slot = _SMART_PAIRS_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            smartPairsStorage.slot := slot
        }
    }
}
