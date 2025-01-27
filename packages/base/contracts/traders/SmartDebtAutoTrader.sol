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
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { ISmartDebtAutoTrader } from "../interfaces/ISmartDebtAutoTrader.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IGenericTraderRouter } from "../routers/interfaces/IGenericTraderRouter.sol";


/**
 * @title   SmartDebtAutoTrader
 * @author  Dolomite
 *
 * Contract for performing internal trades using smart debt
 */
contract SmartDebtAutoTrader is OnlyDolomiteMargin, Initializable, ISmartDebtAutoTrader {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    uint256 private constant _ONE = 1 ether;
    uint256 private constant _TRADE_ACCOUNT_ID = 0;
    uint256 private constant _ZAP_ACCOUNT_ID = 1;


    bytes32 private constant _FILE = "SmartDebtAutoTrader";
    bytes32 private constant _SMART_PAIRS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.smartPairsStorage")) - 1); // solhint-disable-line max-line-length

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;
    uint256 public immutable CHAIN_ID;
    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor(uint256 _chainId, address _dolomiteRegistry, address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {
        CHAIN_ID = _chainId;
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function initialize() external initializer {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    ) external onlyDolomiteMargin(msg.sender) {
        // @todo add generic trader router to dolomite registry
        _setTradeEnabled(true);
    }

    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo memory /* _makerAccount */, // zap account of person making the trade
        IDolomiteStructs.AccountInfo memory _takerAccount, // user who has smart debt enabled
        IDolomiteStructs.Par memory /* oldInputPar */,
        IDolomiteStructs.Par memory /* newInputPar */,
        IDolomiteStructs.Wei memory _inputDeltaWei,
        bytes memory /* data */
    ) external returns (IDolomiteStructs.AssetAmount memory) {
        Require.that(
            tradeEnabled(),
            _FILE,
            "Trade is not enabled"
        );
        _setTradeEnabled(false);

        PairPosition memory pairPosition = userToPair(_takerAccount.owner, _takerAccount.number);
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_inputMarketId, _outputMarketId);

        Require.that(
            pairPosition.pairType != PairType.NONE && pairPosition.pairBytes == pairBytes,
            _FILE,
            "User does not have the pair set"
        );

        // @todo add fee calculations
        // @todo switch to chainlink data streams
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
                isSmartCollateralPair(inputMarketId, outputMarketId),
                _FILE,
                "Collateral pair is not active"
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
                isSmartDebtPair(inputMarketId, outputMarketId),
                _FILE,
                "Debt pair is not active"
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

    function ownerSetGlobalFee(uint256 _globalFee) external onlyDolomiteMarginOwner(msg.sender) {
        _getSmartPairsStorage().globalFee = _globalFee;
        emit GlobalFeeSet(_globalFee);
    }

    function ownerSetAdminFee(uint256 _adminFee) external onlyDolomiteMarginOwner(msg.sender) {
        _getSmartPairsStorage().adminFee = _adminFee;
        emit AdminFeeSet(_adminFee);
    }

    function ownerSetPairFee(uint256 _marketId1, uint256 _marketId2, uint256 _fee) external onlyDolomiteMarginOwner(msg.sender) {
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        _getSmartPairsStorage().pairToFee[pairBytes] = _fee;
        emit PairFeeSet(pairBytes, _fee);
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function getActionsForSmartTrade(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        uint256 _inputAmountWei,
        uint256 _feeAccountId,
        uint256 _makerAccountStartId,
        IGenericTraderRouter.SmartAssetSwapParams[] memory _swaps
    ) external view returns (IDolomiteStructs.ActionArgs[] memory) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_inputMarketId, _outputMarketId);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](_swaps.length + 2);
        uint256 actionCursor;

        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            0,
            address(this),
            bytes("")
        );

        // @todo Encode transfer to fee agent
        uint256 feePercentage = smartPairsStorage.pairToFee[pairBytes] == 0 ? smartPairsStorage.globalFee : smartPairsStorage.pairToFee[pairBytes];
        uint256 adminFeePercentage = smartPairsStorage.adminFee * feePercentage;
        uint256 adminFeeAmount = _inputAmountWei * adminFeePercentage / _ONE;

        // @audit check rounding errors
        actions[actionCursor++] = AccountActionLib.encodeTransferAction(
            _ZAP_ACCOUNT_ID,
            _feeAccountId,
            _inputMarketId,
            IDolomiteStructs.AssetDenomination.Wei,
            adminFeeAmount
        );

        uint256 tradeTotal;
        for (uint256 i; i < _swaps.length; i++) {
            tradeTotal += _swaps[i].amount;
            actions[actionCursor++] = AccountActionLib.encodeInternalTradeActionWithCustomData(
                /* fromAccountId = */ _makerAccountStartId++,
                /* toAccountId = */ _ZAP_ACCOUNT_ID,
                /* primaryMarketId = */ _inputMarketId,
                /* secondaryMarketId = */ _outputMarketId,
                /* traderAddress = */ address(this),
                /* amountInWei = */ _swaps[i].amount,
                /* chainId = */ CHAIN_ID,
                /* calculateAmountWithMakerAccount = */ false,
                /* orderData = */ bytes("")
            );
        }
    }

    function isSmartDebtPair(uint256 _marketId1, uint256 _marketId2) public view returns (bool) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        return smartPairsStorage.smartDebtPairs.contains(pairBytes);
    }

    function isSmartCollateralPair(uint256 _marketId1, uint256 _marketId2) public view returns (bool) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        return smartPairsStorage.smartCollateralPairs.contains(pairBytes);
    }

    function userToPair(address _user, uint256 _accountNumber) public view returns (PairPosition memory) {
        return _getSmartPairsStorage().userToPair[_user][_accountNumber];
    }

    function tradeEnabled() public view returns (bool) {
        return _getSmartPairsStorage().tradeEnabled;
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

    function _setTradeEnabled(bool _tradeEnabled) internal {
        _getSmartPairsStorage().tradeEnabled = _tradeEnabled;
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
