// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite.

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

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { GenericTraderProxyBase } from "./GenericTraderProxyBase.sol";
import { GenericTraderProxyV2Lib } from "./GenericTraderProxyV2Lib.sol";
import { AuthorizationBase } from "../helpers/AuthorizationBase.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { IGenericTraderProxyV2 } from "./interfaces/IGenericTraderProxyV2.sol";


/**
 * @title   GenericTraderProxyV2
 * @author  Dolomite
 *
 * Router contract for trading any asset from msg.sender
 */
contract GenericTraderProxyV2 is GenericTraderProxyBase, ReentrancyGuard, AuthorizationBase, IGenericTraderProxyV2 {
    using TypesLib for IDolomiteStructs.Wei;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "GenericTraderProxyV2";
    uint256 private constant TRANSFER_ACCOUNT_ID = 2;

    // ========================================================
    // ====================== Modifiers =======================
    // ========================================================

    modifier notExpired(uint256 _deadline) {
        Require.that(
            _deadline >= block.timestamp,
            _FILE,
            "Deadline expired",
            _deadline,
            block.timestamp
        );
        _;
    }

    // ========================================================
    // ===================== Constructor ======================
    // ========================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) GenericTraderProxyBase(_dolomiteRegistry) AuthorizationBase(_dolomiteMargin) {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    ) public nonReentrant {
        _swapExactInputForOutput(/* _accountOwner = */ msg.sender, _params);
    }

    function swapExactInputForOutputForDifferentAccount(
        address _accountOwner,
        SwapExactInputForOutputParams memory _params
    ) public nonReentrant requireIsCallerAuthorized(msg.sender) {
        _swapExactInputForOutput(_accountOwner, _params);
    }

    function swapExactInputForOutputAndModifyPosition(
        SwapExactInputForOutputAndModifyPositionParams memory _params
    ) public nonReentrant {
        _swapExactInputForOutputAndModifyPosition(/* _accountOwner = */ msg.sender, _params);
    }

    function swapExactInputForOutputAndModifyPositionForDifferentAccount(
        address _accountOwner,
        SwapExactInputForOutputAndModifyPositionParams memory _params
    ) public nonReentrant requireIsCallerAuthorized(msg.sender) {
        _swapExactInputForOutputAndModifyPosition(_accountOwner, _params);
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _swapExactInputForOutput(
        address _user,
        SwapExactInputForOutputParams memory _params
    ) internal notExpired(_params.userConfig.deadline) {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN(),
            eventEmitterRegistry: DOLOMITE_REGISTRY.eventEmitter(),
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            feeTransferAccountIndex: 0,
            // traders go right after the trade account and zap account
            traderAccountStartIndex: ZAP_ACCOUNT_ID + 1,
            actionsCursor: 0,
            // unused for this function
            inputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: TypesLib.zeroWei()
        });

        _validateMarketIdPath(_params.marketIdsPath);
        _params.inputAmountWei = _getActualInputAmountWei(
            cache,
            _user,
            _params.accountNumber,
            _params.marketIdsPath[0],
            _params.inputAmountWei
        );

        _validateAmountWeis(_params.inputAmountWei, _params.minOutputAmountWei);
        GenericTraderProxyV2Lib.validateTraderParams(
            cache,
            _params.marketIdsPath,
            _params.makerAccounts,
            _params.tradersPath
        );

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(
            cache,
            _params.makerAccounts,
            _user,
            _params.accountNumber,
            _params.tradersPath
        );
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _params.marketIdsPath);

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            _getActionsLengthForTraderParams(
                cache,
                _params.tradersPath,
                accounts,
                _params.minOutputAmountWei
            )
        );
        _appendTraderActions(
            accounts,
            actions,
            cache,
            /* _isLiquidation = */ false,
            _params.marketIdsPath,
            _params.inputAmountWei,
            _params.minOutputAmountWei,
            _params.tradersPath
        );

        cache.dolomiteMargin.operate(accounts, actions);
        cache.eventEmitterRegistry.emitZapExecuted(
            _user,
            _params.accountNumber,
            _params.marketIdsPath,
            _params.tradersPath
        );

        if (
            _params.userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _params.userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                _params.marketIdsPath[0]
            );
        }
    }

    function _swapExactInputForOutputAndModifyPosition(
        address _accountOwner,
        SwapExactInputForOutputAndModifyPositionParams memory _params
    ) internal notExpired(_params.userConfig.deadline) {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN(),
            eventEmitterRegistry: DOLOMITE_REGISTRY.eventEmitter(),
            isMarginDeposit: _params.accountNumber == _params.transferCollateralParams.toAccountNumber,
            otherAccountNumber: _params.accountNumber == _params.transferCollateralParams.toAccountNumber
                ? _params.transferCollateralParams.fromAccountNumber
                : _params.transferCollateralParams.toAccountNumber,
            feeTransferAccountIndex: 0,
            // traders go right after the trade account, the zap account, and the transfer account ("other account")
            traderAccountStartIndex: TRANSFER_ACCOUNT_ID + 1,
            actionsCursor: 0,
            inputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            outputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            transferBalanceWeiBeforeOperate: TypesLib.zeroWei()
        });

        _validateMarketIdPath(_params.marketIdsPath);
        GenericTraderProxyV2Lib.validateTransferParams(cache, _params.transferCollateralParams, _params.accountNumber);

        // If we're transferring into the trade account and the input market is the transfer amount, we check the input
        // amount using the amount being transferred in
        if (
            _params.transferCollateralParams.toAccountNumber == _params.accountNumber
                && _params.marketIdsPath[0] == _params.transferCollateralParams.transferAmounts[0].marketId
        ) {
            _params.inputAmountWei = _getActualInputAmountWei(
                cache,
                _accountOwner,
                _params.transferCollateralParams.fromAccountNumber,
                _params.marketIdsPath[0],
                _params.transferCollateralParams.transferAmounts[0].amountWei
            );
        } else {
            _params.inputAmountWei = _getActualInputAmountWei(
                cache,
                _accountOwner,
                _params.accountNumber,
                _params.marketIdsPath[0],
                _params.inputAmountWei
            );
        }

        _validateAmountWeis(_params.inputAmountWei, _params.minOutputAmountWei);
        GenericTraderProxyV2Lib.validateTraderParams(
            cache,
            _params.marketIdsPath,
            _params.makerAccounts,
            _params.tradersPath
        );

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(
            cache,
            _params.makerAccounts,
            _accountOwner,
            _params.accountNumber,
            _params.tradersPath
        );
        // the call to `_getAccounts` leaves accounts[TRANSFER_ACCOUNT_ID] unset, because it only fills in the traders
        // starting at the `traderAccountCursor` index
        accounts[TRANSFER_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _accountOwner,
            number: cache.otherAccountNumber
        });
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _params.marketIdsPath);

        uint256 transferActionsLength = _getActionsLengthForTransferCollateralParam(_params.transferCollateralParams);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            _getActionsLengthForTraderParams(
                cache,
                _params.tradersPath,
                accounts,
                _params.minOutputAmountWei
            )
                + transferActionsLength
                + _getActionsLengthForExpiryParam(_params.expiryParams)
        );

        _appendTraderActions(
            accounts,
            actions,
            cache,
            /* _isLiquidation = */ false,
            _params.marketIdsPath,
            _params.inputAmountWei,
            _params.minOutputAmountWei,
            _params.tradersPath
        );
        uint256 lastMarketId = _params.marketIdsPath[_params.marketIdsPath.length - 1];
        _appendTransferActions(
            actions,
            cache,
            _params.transferCollateralParams,
            _params.accountNumber,
            transferActionsLength,
            lastMarketId
        );

        _appendExpiryActions(
            actions,
            cache,
            _params.expiryParams,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID] // solium-disable-line indentation
        );

        // snapshot the balances before so they can be logged in `_logEvents`
        _snapshotBalancesInCache(
            cache,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID], // solium-disable-line indentation
            _params.marketIdsPath,
            _params.transferCollateralParams
        );

        GenericTraderProxyV2Lib.logBeforeZapEvents(
            cache,
            accounts[TRADE_ACCOUNT_ID],
            _params.userConfig.eventType
        );

        cache.dolomiteMargin.operate(accounts, actions);

        GenericTraderProxyV2Lib.logAfterZapEvents(
            cache,
            accounts[TRADE_ACCOUNT_ID],
            _params.marketIdsPath,
            _params.tradersPath,
            _params.transferCollateralParams,
            _params.userConfig.eventType
        );

        if (
            _params.userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _params.userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            uint256 inputMarketId = _params.marketIdsPath[0];
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                inputMarketId
            );
        }

        if (
            _params.userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _params.userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To
        ) {
            uint256 length = _params.transferCollateralParams.transferAmounts.length;
            for (uint256 i; i < length; ++i) {
                AccountBalanceLib.verifyBalanceIsNonNegative(
                    cache.dolomiteMargin,
                    accounts[TRANSFER_ACCOUNT_ID].owner,
                    accounts[TRANSFER_ACCOUNT_ID].number,
                    _params.transferCollateralParams.transferAmounts[i].marketId
                );
            }
        }
    }

    function _appendTransferActions(
        IDolomiteStructs.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        TransferCollateralParam memory _transferCollateralParam,
        uint256 _traderAccountNumber,
        uint256 _transferActionsLength,
        uint256 _lastMarketId
    ) internal view {
        // the `_traderAccountNumber` is always `accountId=0`
        uint256 fromAccountId = _transferCollateralParam.fromAccountNumber == _traderAccountNumber
            ? TRADE_ACCOUNT_ID
            : TRANSFER_ACCOUNT_ID;

        uint256 toAccountId = _transferCollateralParam.fromAccountNumber == _traderAccountNumber
            ? TRANSFER_ACCOUNT_ID
            : TRADE_ACCOUNT_ID;

        for (uint256 i; i < _transferActionsLength; i++) {
            if (_transferCollateralParam.transferAmounts[i].amountWei == type(uint256).max - 1) {
                Require.that(
                    _transferCollateralParam.transferAmounts[i].marketId == _lastMarketId,
                    _FILE,
                    "Invalid transfer marketId",
                    _transferCollateralParam.transferAmounts[i].marketId
                );
                Require.that(
                    fromAccountId == TRADE_ACCOUNT_ID,
                    _FILE,
                    "Invalid from account ID"
                );

                // We transfer to the amount we had before the swap finished
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferToTargetAmountAction(
                    fromAccountId,
                    toAccountId,
                    _transferCollateralParam.transferAmounts[i].marketId,
                    _cache.dolomiteMargin.getAccountWei(
                        IDolomiteStructs.AccountInfo({
                            owner: msg.sender,
                            number: _transferCollateralParam.fromAccountNumber
                        }),
                        _transferCollateralParam.transferAmounts[i].marketId
                    )
                );
            } else {
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferAction(
                    fromAccountId,
                    toAccountId,
                    _transferCollateralParam.transferAmounts[i].marketId,
                    IDolomiteStructs.AssetDenomination.Wei,
                    _transferCollateralParam.transferAmounts[i].amountWei
                );
            }
        }
    }

    function _appendExpiryActions(
        IDolomiteStructs.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        ExpiryParam memory _param,
        IDolomiteStructs.AccountInfo memory _tradeAccount
    ) internal view {
        if (_param.expiryTimeDelta == 0) {
            // Don't append it if there's no expiry
            return;
        }

        _actions[_cache.actionsCursor++] = AccountActionLib.encodeExpirationAction(
            _tradeAccount,
            TRADE_ACCOUNT_ID,
            _param.marketId,
            address(DOLOMITE_REGISTRY.expiry()),
            _param.expiryTimeDelta
        );
    }

    function _snapshotBalancesInCache(
        GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        TransferCollateralParam memory _param
    ) internal view {
        _cache.inputBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _marketIdsPath[0]
        );
        _cache.outputBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _marketIdsPath[_marketIdsPath.length - 1]
        );
        _cache.transferBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _param.transferAmounts[0].marketId
        );
    }

    function _getActualInputAmountWei(
        GenericTraderProxyCache memory _cache,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _inputAmountWei
    ) internal view returns (uint256) {
        if (_inputAmountWei != type(uint256).max) {
            return _inputAmountWei;
        }

        IDolomiteStructs.Wei memory balanceWei = _cache.dolomiteMargin.getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        Require.that(
            !balanceWei.isNegative(),
            _FILE,
            "Balance must be positive",
            _marketId
        );
        return balanceWei.value;
    }

    function _getActionsLengthForTransferCollateralParam(
        TransferCollateralParam memory _param
    ) internal pure returns (uint256) {
        return _param.transferAmounts.length;
    }

    function _getActionsLengthForExpiryParam(
        ExpiryParam memory _param
    ) internal pure returns (uint256) {
        if (_param.expiryTimeDelta == 0) {
            return 0;
        } else {
            return 1;
        }
    }

    function _otherAccountId() internal pure override returns (uint256) {
        return TRADE_ACCOUNT_ID;
    }
}
