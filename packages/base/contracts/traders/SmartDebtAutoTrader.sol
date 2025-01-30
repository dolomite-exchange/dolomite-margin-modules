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
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { ISmartDebtAutoTrader } from "../interfaces/traders/ISmartDebtAutoTrader.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { InternalAutoTraderBase } from "./InternalAutoTraderBase.sol";
import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IInternalAutoTraderBase } from "../interfaces/traders/IInternalAutoTraderBase.sol";

/**
 * @title   SmartDebtAutoTrader
 * @author  Dolomite
 *
 * Contract for performing internal trades using smart debt
 */
contract SmartDebtAutoTrader is InternalAutoTraderBase, ISmartDebtAutoTrader {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    uint256 private constant _ONE = 1 ether;

    bytes32 private constant _FILE = "SmartDebtAutoTrader";
    bytes32 private constant _SMART_PAIRS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.smartPairsStorage")) - 1); // solhint-disable-line max-line-length

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor(
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) InternalAutoTraderBase(_chainId, _dolomiteRegistry, _dolomiteMargin) {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    // @todo mapping blockNumber => marketId => price. Do it here in callFunction once we have data streams
    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    ) public override onlyDolomiteMargin(msg.sender) {
        // @follow-up Does this do a new call? I don't think so but check
        super.callFunction(_sender, _accountInfo, _data);
    }

    // maker account is the zap account of the person making the trade
    // taker account is the user who has smart debt enabled
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo memory /* _makerAccount */,
        IDolomiteStructs.AccountInfo memory _takerAccount,
        IDolomiteStructs.Par memory /* oldInputPar */,
        IDolomiteStructs.Par memory /* newInputPar */,
        IDolomiteStructs.Wei memory _inputDeltaWei,
        bytes memory _data
    ) external override(IDolomiteAutoTrader, InternalAutoTraderBase) returns (IDolomiteStructs.AssetAmount memory) {
        Require.that(
            tradeEnabled(),
            _FILE,
            "Trade is not enabled"
        );

        PairPosition memory pairPosition = userToPair(_takerAccount.owner, _takerAccount.number);
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_inputMarketId, _outputMarketId);
        Require.that(
            pairPosition.pairType != PairType.NONE && pairPosition.pairBytes == pairBytes,
            _FILE,
            "User does not have the pair set"
        );

        // @audit Do we need to check the sign of inputDeltaWei?
        // @todo switch to chainlink data streams
        uint256 adjInputAmount;
        {
            // @dev the adminFeeAmount was already subtracted from the inputDeltaWei but since it is a percentage
            // of the full fee amount, we need to add it back in and then calculate adjInputAmount
            (, uint256 feePercentage) = _getFees(pairBytes);
            (, uint256 adminFeeAmount) = abi.decode(_data, (uint256, uint256));
            adjInputAmount = (_inputDeltaWei.value + adminFeeAmount) * (_ONE - feePercentage) / _ONE;
        }

        uint256 inputMarketId = _inputMarketId;
        uint256 outputMarketId = _outputMarketId;
        uint256 inputValue = adjInputAmount * DOLOMITE_MARGIN().getMarketPrice(inputMarketId).value;
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
                !takerAccountWei.sign && takerAccountWei.value >= adjInputAmount,
                _FILE,
                "Insufficient debt"
            );
        }

        (uint256 minOutputAmount, ) = abi.decode(_data, (uint256, uint256));
        Require.that(
            outputTokenAmount >= minOutputAmount,
            _FILE,
            "Insufficient output token amount"
        );

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

    function ownerSetPairFee(
        uint256 _marketId1,
        uint256 _marketId2,
        uint256 _fee
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPairFee(_marketId1, _marketId2, _fee);
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) external view override(IInternalAutoTraderBase, InternalAutoTraderBase) returns (IDolomiteStructs.ActionArgs[] memory) {
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            actionsLength(_params.trades.length)
        );
        // @todo Make fee percentages decimal type and use the lib
        (uint256 adminFeePercentage, uint256 feePercentage) = _getFees(_params.inputMarketId, _params.outputMarketId);
        uint256 actionCursor;

        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            /* accountId = */ 0,
            address(this),
            abi.encode(true)
        );
        actions[actionCursor++] = AccountActionLib.encodeTransferAction(
            _params.takerAccountId,
            _params.feeAccountId,
            _params.inputMarketId,
            IDolomiteStructs.AssetDenomination.Wei,
            _params.inputAmountWei * adminFeePercentage / _ONE * feePercentage / _ONE
        );
        // @audit check rounding errors

        uint256 tradeTotal;
        for (uint256 i; i < _params.trades.length; i++) {
            uint256 originalAmountInWei = _params.trades[i].amount;
            uint256 minOutputAmount = _params.trades[i].minOutputAmount;
            tradeTotal += originalAmountInWei;

            uint256 adminFeeAmount = originalAmountInWei * adminFeePercentage * feePercentage / _ONE / _ONE;
            actions[actionCursor++] = AccountActionLib.encodeInternalTradeActionWithWhitelistedTrader(
                /* takerAccountId = */ _params.takerAccountId,
                /* makerAccountId = */ _params.trades[i].makerAccountId,
                /* primaryMarketId = */ _params.inputMarketId,
                /* secondaryMarketId = */ _params.outputMarketId,
                /* traderAddress = */ address(this),
                /* amountInWei = */ originalAmountInWei - adminFeeAmount,
                /* chainId = */ CHAIN_ID,
                /* calculateAmountWithMakerAccount = */ true, // @todo Add tests on non-arbitrum chain
                /* orderData = */ abi.encode(minOutputAmount, adminFeeAmount)
            );
        }

        actions[actionCursor++] = AccountActionLib.encodeCallAction(
            0,
            address(this),
            abi.encode(false)
        );

        Require.that(
            tradeTotal == _params.inputAmountWei,
            _FILE,
            "Invalid swap amounts sum"
        );

        return actions;
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

    function pairFee(uint256 _marketId1, uint256 _marketId2) public view returns (uint256) {
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        return _getSmartPairsStorage().pairToFee[pairBytes];
    }

    function actionsLength(uint256 _swaps) public pure override(IInternalAutoTraderBase, InternalAutoTraderBase) returns (uint256) {
        return _swaps + 3;
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

        bool wasAdded = smartPairsStorage.smartCollateralPairs.add(pairBytes);
        Require.that(
            wasAdded,
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

        bool wasRemoved = smartPairsStorage.smartDebtPairs.remove(pairBytes);
        Require.that(
            wasRemoved,
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

    function _ownerSetPairFee(uint256 _marketId1, uint256 _marketId2, uint256 _fee) internal {
        (bytes32 pairBytes, ,) = _getPairBytesAndSortMarketIds(_marketId1, _marketId2);
        _getSmartPairsStorage().pairToFee[pairBytes] = _fee;
        emit PairFeeSet(pairBytes, _fee);
    }

    function _getFees(uint256 _inputMarketId, uint256 _outputMarketId) internal view returns (uint256, uint256) {
        (uint256 adminFee, uint256 globalFee) = super._getFees();
        uint256 pairFeeOverride = pairFee(_inputMarketId, _outputMarketId);

        return (adminFee, pairFeeOverride == 0 ? globalFee : pairFeeOverride);
    }

    function _getFees(bytes32 _pairBytes) internal view returns (uint256, uint256) {
        SmartPairsStorage storage smartPairsStorage = _getSmartPairsStorage();

        (uint256 adminFee, uint256 globalFee) = super._getFees();
        uint256 pairFeeOverride = smartPairsStorage.pairToFee[_pairBytes];

        return (adminFee, pairFeeOverride == 0 ? globalFee : pairFeeOverride);
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
