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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMargin.sol";
import { ISmartDebtAutoTrader } from "../interfaces/ISmartDebtAutoTrader.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   SmartDebtAutoTrader
 * @author  Dolomite
 *
 * Contract for performing internal trades using smart debt
 */
contract SmartDebtAutoTrader is OnlyDolomiteMarginForUpgradeable, Initializable, ISmartDebtAutoTrader {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "SmartDebtAutoTrader";
    bytes32 private constant _SMART_PAIRS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.smartPairsStorage")) - 1); // solhint-disable-line max-line-length

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor() OnlyDolomiteMarginForUpgradeable() {
    }

    function initialize(address _dolomiteMargin) external initializer {
        _setDolomiteMarginViaSlot(_dolomiteMargin);
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo memory /* _makerAccount */, // zap account of person making the trade
        IDolomiteStructs.AccountInfo memory _takerAccount, // user who has smart debt enabled
        IDolomiteStructs.Par memory /* oldInputPar */,
        IDolomiteStructs.Par memory /* newInputPar */,
        IDolomiteStructs.Wei memory _inputDeltaWei,
        bytes memory _data
    ) external returns (IDolomiteStructs.AssetAmount memory) {
        PairPosition memory pairPosition = userToPair(_takerAccount.owner, _takerAccount.number);
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_inputMarketId, _outputMarketId);

        Require.that(
            pairPosition.pairType != PairType.NONE && pairPosition.pairBytes == pairBytes,
            _FILE,
            "User does not have the pair set"
        );

        // use price oracles to get the amounts
        uint256 inputMarketId = _inputMarketId;
        uint256 outputMarketId = _outputMarketId;
        uint256 inputValue = _inputDeltaWei.value * DOLOMITE_MARGIN().getMarketPrice(inputMarketId).value;
        uint256 outputTokenAmount = inputValue / DOLOMITE_MARGIN().getMarketPrice(outputMarketId).value;

        if (pairPosition.pairType == PairType.SMART_COLLATERAL) {
            // if smart collateral, confirm taker has more collateral than output token amount
            IDolomiteStructs.Wei memory takerAccountWei = DOLOMITE_MARGIN().getAccountWei(
                _takerAccount,
                outputMarketId
            );
            Require.that(
                takerAccountWei.sign && takerAccountWei.value >= outputTokenAmount,
                _FILE,
                "Insufficient collateral"
            );
        } else {
            // if smart debt confirm taker has more debt than input token amount
            IDolomiteStructs.Wei memory takerAccountWei = DOLOMITE_MARGIN().getAccountWei(
                _takerAccount,
                inputMarketId
            );
            Require.that(
                !takerAccountWei.sign && takerAccountWei.value >= _inputDeltaWei.value,
                _FILE,
                "Insufficient debt"
            );
        }

        return IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: outputTokenAmount
        });
    }

    function userSetPair(uint256 _accountNumber, PairType _pairType, uint256 _marketId1, uint256 _marketId2) external {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();

        if (_pairType == PairType.NONE && _marketId1 == 0 && _marketId2 == 0) {
            smartPairsStorage.userToPair[msg.sender][_accountNumber] = PairPosition({
                pairType: PairType.NONE,
                pairBytes: bytes32(0)
            });
            emit UserToPairSet(msg.sender, _accountNumber, _pairType, bytes32(0));
            return;
        }

        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        if (_pairType == PairType.SMART_DEBT) {
            Require.that(
                smartPairsStorage.smartDebtPairs.contains(pairBytes),
                _FILE,
                "Pair does not exist"
            );
        } else if (_pairType == PairType.SMART_COLLATERAL) {
            Require.that(
                smartPairsStorage.smartCollateralPairs.contains(pairBytes),
                _FILE,
                "Pair does not exist"
            );
        } else {
            revert("Invalid pair type");
        }

        smartPairsStorage.userToPair[msg.sender][_accountNumber] = PairPosition({
            pairType: _pairType,
            pairBytes: pairBytes
        });
        emit UserToPairSet(msg.sender, _accountNumber, _pairType, pairBytes);
    }

    // ========================================================
    // ==================== Admin Functions ===================
    // ========================================================

    function ownerAddSmartDebtPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerAddSmartDebtPair(_marketId1, _marketId2);
    }

    function ownerRemoveSmartDebtPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerRemoveSmartDebtPair(_marketId1, _marketId2);
    }

    function ownerAddSmartCollateralPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerAddSmartCollateralPair(_marketId1, _marketId2);
    }

    function ownerRemoveSmartCollateralPair(
        uint256 _marketId1,
        uint256 _marketId2
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerRemoveSmartCollateralPair(_marketId1, _marketId2);
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function isSmartDebtPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        return smartPairsStorage.smartDebtPairs.contains(pairBytes);
    }

    function isSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) external view returns (bool) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        return smartPairsStorage.smartCollateralPairs.contains(pairBytes);
    }

    function userToPair(address _user, uint256 _accountNumber) public view returns (PairPosition memory) {
        return _getSmartPairsStorage().userToPair[_user][_accountNumber];
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _ownerAddSmartDebtPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (
            bytes32 pairBytes,
            uint256 sortedMarketId1,
            uint256 sortedMarketId2
        ) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);

        bool res = smartPairsStorage.smartDebtPairs.add(pairBytes);
        Require.that(
            res,
            _FILE,
            "Pair already exists"
        );
        emit SmartDebtPairAdded(sortedMarketId1, sortedMarketId2);
    }

    function _ownerAddSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (
            bytes32 pairBytes,
            uint256 sortedMarketId1,
            uint256 sortedMarketId2
        ) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);

        bool res = smartPairsStorage.smartCollateralPairs.add(pairBytes);
        Require.that(
            res,
            _FILE,
            "Pair already exists"
        );
        emit SmartCollateralPairAdded(sortedMarketId1, sortedMarketId2);
    }

    function _ownerRemoveSmartDebtPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (
            bytes32 pairBytes,
            uint256 sortedMarketId1,
            uint256 sortedMarketId2
        ) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);

        // @follow-up This is messy but if I put it in require statement then coverage fails
        bool res = smartPairsStorage.smartDebtPairs.remove(pairBytes);
        Require.that(
            res,
            _FILE,
            "Pair does not exist"
        );
        emit SmartDebtPairRemoved(sortedMarketId1, sortedMarketId2);
    }

    function _ownerRemoveSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) internal {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (
            bytes32 pairBytes,
            uint256 sortedMarketId1,
            uint256 sortedMarketId2
        ) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);

        bool res = smartPairsStorage.smartCollateralPairs.remove(pairBytes);
        Require.that(
            res,
            _FILE,
            "Pair does not exist"
        );
        emit SmartCollateralPairRemoved(sortedMarketId1, sortedMarketId2);
    }

    function _getPairBytesAndSortMarketIds(
        uint256 _marketId1,
        uint256 _marketId2
    ) internal pure returns (bytes32, uint256, uint256) {
        Require.that(
            _marketId1 != _marketId2,
            _FILE,
            "Market IDs must be different"
        );

        if (_marketId1 < _marketId2) {
            return (keccak256(abi.encode(_marketId1, _marketId2)), _marketId1, _marketId2);
        } else {
            return (keccak256(abi.encode(_marketId2, _marketId1)), _marketId2, _marketId1);
        }
    }

    function _getSmartPairsStorage() internal pure returns (SmartPairsStorage storage smartPairsStorage) {
        bytes32 slot = _SMART_PAIRS_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            smartPairsStorage.slot := slot
        }
    }
}
