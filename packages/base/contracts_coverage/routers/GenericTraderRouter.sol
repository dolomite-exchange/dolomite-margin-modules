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

import { GenericTraderRouterBase } from "./GenericTraderRouterBase.sol";
import { GenericTraderRouterLib } from "./GenericTraderRouterLib.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { IGenericTraderRouter } from "./interfaces/IGenericTraderRouter.sol";


/**
 * @title   GenericTraderRouter
 * @author  Dolomite
 *
 * Router contract for trading any asset from msg.sender
 */
contract GenericTraderRouter is GenericTraderRouterBase, IGenericTraderRouter {
    using TypesLib for IDolomiteStructs.Wei;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "GenericTraderRouter";
    uint256 private constant TRANSFER_ACCOUNT_ID = 2;

    // @todo need to be storage slot so upgradeable
    IExpiry public EXPIRY;
    IEventEmitterRegistry public EVENT_EMITTER_REGISTRY;

    // ========================================================
    // ====================== Modifiers =======================
    // ========================================================

    modifier notExpired(uint256 _deadline) {
        if (_deadline >= block.timestamp) { /* FOR COVERAGE TESTING */ }
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
        address _expiry,
        address _eventEmitterRegistry,
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) GenericTraderRouterBase(_chainId, _dolomiteRegistry, _dolomiteMargin) {
        EXPIRY = IExpiry(_expiry);
        EVENT_EMITTER_REGISTRY = IEventEmitterRegistry(_eventEmitterRegistry);
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function ownerSetEventEmitterRegistry(
        address _eventEmitterRegistry
    ) external onlyDolomiteMarginOwner(msg.sender) {
        EVENT_EMITTER_REGISTRY = IEventEmitterRegistry(_eventEmitterRegistry);
    }

    // @todo add parameter for vaultMarketId and if so, call iso vault and if not, call directly on generic trader proxy
    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        UserConfig memory _userConfig
    ) public nonReentrant notExpired(_userConfig.deadline) {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN(),
            eventEmitterRegistry: EVENT_EMITTER_REGISTRY,
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
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

        _validateMarketIdPath(_marketIdsPath);
        _inputAmountWei = _getActualInputAmountWei(
            cache,
            _tradeAccountNumber,
            _marketIdsPath[0],
            _inputAmountWei
        );

        _validateAmountWeis(_inputAmountWei, _minOutputAmountWei);
        _validateTraderParams(
            cache,
            _marketIdsPath,
            _makerAccounts,
            _tradersPath
        );

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(
            cache,
            _makerAccounts,
            /* _tradeAccountOwner = */ msg.sender, // solium-disable-line indentation
            _tradeAccountNumber
        );
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _marketIdsPath);

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](_getActionsLengthForTraderParams(_tradersPath));
        _appendTraderActions(
            accounts,
            actions,
            cache,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath
        );

        cache.dolomiteMargin.operate(accounts, actions);
        cache.eventEmitterRegistry.emitZapExecuted(
            msg.sender,
            _tradeAccountNumber,
            _marketIdsPath,
            _tradersPath
        );

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                _marketIdsPath[0]
            );
        }
    }

    // @todo add external functions for addCollateralAndSwapExactInputForOutput and removeCollateralAndSwapExactInputForOutput
    // if it is not an isolation mode market, assemble call to swapExactInputForOutputAndModifyPosition behind the scenes

    // adjust to just forward this function to the generic trader proxy
    // @todo will need to adjust proxy to take in a fromAccount address
    function swapExactInputForOutputAndModifyPosition(
        uint256 _tradeAccountNumber,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        TransferCollateralParam memory _transferCollateralParams,
        ExpiryParam memory _expiryParams,
        UserConfig memory _userConfig
    )
        public
        nonReentrant
        notExpired(_userConfig.deadline)
    {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN(),
            eventEmitterRegistry: EVENT_EMITTER_REGISTRY,
            isMarginDeposit: _tradeAccountNumber == _transferCollateralParams.toAccountNumber,
            otherAccountNumber: _tradeAccountNumber == _transferCollateralParams.toAccountNumber
                ? _transferCollateralParams.fromAccountNumber
                : _transferCollateralParams.toAccountNumber,
            // traders go right after the trade account, the zap account, and the transfer account ("other account")
            traderAccountStartIndex: TRANSFER_ACCOUNT_ID + 1,
            actionsCursor: 0,
            inputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            outputBalanceWeiBeforeOperate: TypesLib.zeroWei(),
            transferBalanceWeiBeforeOperate: TypesLib.zeroWei()
        });

        _validateMarketIdPath(_marketIdsPath);
        _validateTransferParams(cache, _transferCollateralParams, _tradeAccountNumber);

        // If we're transferring into the trade account and the input market is the transfer amount, we check the input
        // amount using the amount being transferred in
        if (
            _transferCollateralParams.toAccountNumber == _tradeAccountNumber
                && _marketIdsPath[0] == _transferCollateralParams.transferAmounts[0].marketId
        ) {
            _inputAmountWei = _getActualInputAmountWei(
                cache,
                _transferCollateralParams.fromAccountNumber,
                _marketIdsPath[0],
                _transferCollateralParams.transferAmounts[0].amountWei
            );
        } else {
            _inputAmountWei = _getActualInputAmountWei(
                cache,
                _tradeAccountNumber,
                _marketIdsPath[0],
                _inputAmountWei
            );
        }

        _validateAmountWeis(_inputAmountWei, _minOutputAmountWei);
        _validateTraderParams(
            cache,
            _marketIdsPath,
            _makerAccounts,
            _tradersPath
        );

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(
            cache,
            _makerAccounts,
            /* _tradeAccountOwner = */ msg.sender, // solium-disable-line indentation
            _tradeAccountNumber
        );
        // the call to `_getAccounts` leaves accounts[TRANSFER_ACCOUNT_ID] unset, because it only fills in the traders
        // starting at the `traderAccountCursor` index
        accounts[TRANSFER_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: cache.otherAccountNumber
        });
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _marketIdsPath);

        uint256 transferActionsLength = _getActionsLengthForTransferCollateralParam(_transferCollateralParams);
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            _getActionsLengthForTraderParams(_tradersPath)
                + transferActionsLength
                + _getActionsLengthForExpiryParam(_expiryParams)
        );

        // solium-disable indentation
        {
            // To avoid the "stack too deep" error, we rearrange the stack
            uint256[] memory marketIdsPathForStackTooDeep = _marketIdsPath;
            uint256 inputAmountWeiForStackTooDeep = _inputAmountWei;
            uint256 minOutputAmountWeiForStackTooDeep = _minOutputAmountWei;
            TraderParam[] memory tradersPathForStackTooDeep = _tradersPath;
            _appendTraderActions(
                accounts,
                actions,
                cache,
                marketIdsPathForStackTooDeep,
                inputAmountWeiForStackTooDeep,
                minOutputAmountWeiForStackTooDeep,
                tradersPathForStackTooDeep
            );
        }
        {
            // To avoid the "stack too deep" error, we rearrange the stack
            uint256 lastMarketId = _marketIdsPath[_marketIdsPath.length - 1];
            uint256 tradeAccountNumberForStackTooDeep = _tradeAccountNumber;
            _appendTransferActions(
                actions,
                cache,
                _transferCollateralParams,
                tradeAccountNumberForStackTooDeep,
                transferActionsLength,
                lastMarketId
            );
        }
        // solium-enable indentation
        _appendExpiryActions(
            actions,
            cache,
            _expiryParams,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID] // solium-disable-line indentation
        );

        // snapshot the balances before so they can be logged in `_logEvents`
        _snapshotBalancesInCache(
            cache,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID], // solium-disable-line indentation
            _marketIdsPath,
            _transferCollateralParams
        );

        GenericTraderRouterLib.logBeforeZapEvents(
            cache,
            accounts[TRADE_ACCOUNT_ID],
            _userConfig.eventType
        );

        cache.dolomiteMargin.operate(accounts, actions);

        // solium-disable indentation
        {
            uint256[] memory marketIdsPathForStackTooDeep = _marketIdsPath;
            GenericTraderRouterLib.logAfterZapEvents(
                cache,
                accounts[TRADE_ACCOUNT_ID],
                marketIdsPathForStackTooDeep,
                _tradersPath,
                _transferCollateralParams,
                _userConfig.eventType
            );
        }
        // solium-enable indentation

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            uint256 inputMarketId = _marketIdsPath[0];
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                inputMarketId
            );
        }

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To
        ) {
            uint256 length = _transferCollateralParams.transferAmounts.length;
            for (uint256 i; i < length; ++i) {
                AccountBalanceLib.verifyBalanceIsNonNegative(
                    cache.dolomiteMargin,
                    accounts[TRANSFER_ACCOUNT_ID].owner,
                    accounts[TRANSFER_ACCOUNT_ID].number,
                    _transferCollateralParams.transferAmounts[i].marketId
                );
            }
        }
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

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
            address(EXPIRY),
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
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _inputAmountWei
    ) internal view returns (uint256) {
        if (_inputAmountWei != type(uint256).max) {
            return _inputAmountWei;
        }

        IDolomiteStructs.Wei memory balanceWei = _cache.dolomiteMargin.getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: msg.sender,
                number: _accountNumber
            }),
            _marketId
        );
        if (!balanceWei.isNegative()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !balanceWei.isNegative(),
            _FILE,
            "Balance must be positive",
            _marketId
        );
        return balanceWei.value;
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
                if (_transferCollateralParam.transferAmounts[i].marketId == _lastMarketId) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    _transferCollateralParam.transferAmounts[i].marketId == _lastMarketId,
                    _FILE,
                    "Invalid transfer marketId",
                    _transferCollateralParam.transferAmounts[i].marketId
                );
                if (fromAccountId == TRADE_ACCOUNT_ID) { /* FOR COVERAGE TESTING */ }
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

    function _validateTransferParams(
        GenericTraderProxyCache memory _cache,
        TransferCollateralParam memory _param,
        uint256 _tradeAccountNumber
    ) internal pure {
        if (_param.transferAmounts.length != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _param.transferAmounts.length != 0,
            _FILE,
            "Invalid transfer amounts length"
        );
        if (_param.fromAccountNumber != _param.toAccountNumber) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _param.fromAccountNumber != _param.toAccountNumber,
            _FILE,
            "Cannot transfer to same account"
        );
        if (_tradeAccountNumber == _param.fromAccountNumber ||  _tradeAccountNumber == _param.toAccountNumber) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tradeAccountNumber == _param.fromAccountNumber ||  _tradeAccountNumber == _param.toAccountNumber,
            _FILE,
            "Invalid trade account number"
        );
        _cache.otherAccountNumber = _tradeAccountNumber == _param.toAccountNumber
            ? _param.fromAccountNumber
            : _param.toAccountNumber;

        uint256 length = _param.transferAmounts.length;
        for (uint256 i; i < length; ++i) {
            if (_param.transferAmounts[i].amountWei != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _param.transferAmounts[i].amountWei != 0,
                _FILE,
                "Invalid transfer amount at index",
                i
            );
        }
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
