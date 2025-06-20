// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;

import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IIsolationModeUnwrapperTraderV2 } from "../isolation-mode/interfaces/IIsolationModeUnwrapperTraderV2.sol";
import { IIsolationModeWrapperTraderV2 } from "../isolation-mode/interfaces/IIsolationModeWrapperTraderV2.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IInternalAutoTraderBase } from "../smart-debt/interfaces/IInternalAutoTraderBase.sol";


/**
 * @title   GenericTraderProxyBase
 * @author  Dolomite
 *
 * @notice  Base contract with validation and utilities for trading any asset from an account
 */
abstract contract GenericTraderProxyBase is IGenericTraderBase {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "GenericTraderProxyBase";

    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;

    uint256 internal constant ARBITRUM_ONE = 42161;
    bytes32 internal constant DOLOMITE_FS_GLP_HASH = keccak256(bytes("Dolomite: Fee + Staked GLP"));
    string internal constant DOLOMITE_ISOLATION_PREFIX = "Dolomite Isolation:";

    /// @dev The index of the trade account in the accounts array (for executing an operation)
    uint256 internal constant TRADE_ACCOUNT_ID = 0;
    uint256 internal constant ZAP_ACCOUNT_ID = 1;

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        address _dolomiteRegistry
    ) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function _validateMarketIdPath(
        uint256[] memory _marketIdsPath
    ) internal pure {
        Require.that(
            _marketIdsPath.length >= 2,
            _FILE,
            "Invalid market path length"
        );
    }

    function _validateAmountWeis(
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei
    ) internal pure {
        Require.that(
            _inputAmountWei != 0,
            _FILE,
            "Invalid inputAmountWei"
        );
        Require.that(
            _minOutputAmountWei != 0,
            _FILE,
            "Invalid minOutputAmountWei"
        );
    }

    function _validateZapAccount(
        GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIdsPath
    ) internal view {
        uint256 marketIdsLength = _marketIdsPath.length;
        for (uint256 i; i < marketIdsLength; ++i) {
            // Panic if we're zapping to an account that has any value in it. Why? Because we don't want execute trades
            // where we sell ALL if there's already value in the account. That would mess up the user's holdings and
            // unintentionally sell assets the user does not want to sell.
            assert(_cache.dolomiteMargin.getAccountPar(_account, _marketIdsPath[i]).value == 0);
        }
    }

    function _getAccounts(
        GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        address _tradeAccountOwner,
        uint256 _tradeAccountNumber,
        IGenericTraderBase.TraderParam[] memory _tradersPath
    )
        internal
        view
        returns (IDolomiteStructs.AccountInfo[] memory)
    {
        bool foundInternalLiq = false;
        for (uint256 i; i < _tradersPath.length; ++i) {
            if (_tradersPath[i].traderType == TraderType.InternalLiquidity) {
                foundInternalLiq = true;
                _cache.feeTransferAccountIndex = _cache.traderAccountStartIndex;
                _cache.traderAccountStartIndex = _cache.feeTransferAccountIndex + 1;
                break;
            }
        }

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](
            _cache.traderAccountStartIndex + _makerAccounts.length
        );
        accounts[TRADE_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _tradeAccountOwner,
            number: _tradeAccountNumber
        });
        accounts[ZAP_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _tradeAccountOwner,
            number: _calculateZapAccountNumber(_tradeAccountOwner, _tradeAccountNumber)
        });
        if (foundInternalLiq) {
            accounts[_cache.feeTransferAccountIndex] = IDolomiteStructs.AccountInfo({
                owner: DOLOMITE_REGISTRY.feeAgent(),
                number: DEFAULT_ACCOUNT_NUMBER
            });
        }
        _appendTradersToAccounts(_cache, _makerAccounts, accounts);
        return accounts;
    }

    function _appendTradersToAccounts(
        GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IDolomiteStructs.AccountInfo[] memory _accounts
    )
        internal
        pure
    {
        uint256 makerAccountsLength = _makerAccounts.length;
        for (uint256 i; i < makerAccountsLength; ++i) {
            IDolomiteStructs.AccountInfo memory account = _accounts[_cache.traderAccountStartIndex + i];
            assert(account.owner == address(0) && account.number == 0);

            _accounts[_cache.traderAccountStartIndex + i] = IDolomiteStructs.AccountInfo({
                owner: _makerAccounts[i].owner,
                number: _makerAccounts[i].number
            });
        }
    }

    function _getActionsLengthForTraderParams(
        GenericTraderProxyCache memory _cache,
        TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _accounts,
        uint256 _minOutputAmountWei
    )
        internal
        view
        returns (uint256)
    {
        uint256 actionsLength = 2; // start at 2 for the zap in/out of the zap account (2 transfer actions)
        uint256 tradersPathLength = _tradersPath.length;
        for (uint256 i; i < tradersPathLength; ++i) {
            if (_isUnwrapperTraderType(_tradersPath[i].traderType)) {
                actionsLength += IIsolationModeUnwrapperTraderV2(_tradersPath[i].trader).actionsLength();
            } else if (_isWrapperTraderType(_tradersPath[i].traderType)) {
                actionsLength += IIsolationModeWrapperTraderV2(_tradersPath[i].trader).actionsLength();
            } else if (_tradersPath[i].traderType == TraderType.InternalLiquidity) {
                actionsLength += IInternalAutoTraderBase(_tradersPath[i].trader).actionsLength(
                    _createSwapDataFromTradeParams(
                        _cache,
                        _tradersPath,
                        _accounts,
                        _minOutputAmountWei,
                        i
                    )
                );
            } else {
                // If it's not a `wrap` or `unwrap`, trades only require 1 action
                actionsLength += 1;
            }
        }
        return actionsLength;
    }

    function _appendTraderActions(
        IDolomiteStructs.AccountInfo[] memory _accounts,
        IDolomiteStructs.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        bool _isLiquidation,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath
    )
        internal
        view
    {
        // Before the trades are started, transfer inputAmountWei of the inputMarket
        // from the TRADE account to the ZAP account
        if (_inputAmountWei == AccountActionLib.all()) {

            IDolomiteStructs.Wei memory targetAmountWei;
            if (_isLiquidation) {
                // For liquidations, we TARGET whatever the trader has right now, before the operation occurs
                targetAmountWei = _cache.dolomiteMargin.getAccountWei(
                    _accounts[TRADE_ACCOUNT_ID],
                    _marketIdsPath[0]
                );
            } else {
                // For non-liquidations, we want to run the balance down to zero
                targetAmountWei = IDolomiteStructs.Wei({
                    sign: false,
                    value: 0
                });
            }

            _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferToTargetAmountAction(
                TRADE_ACCOUNT_ID,
                ZAP_ACCOUNT_ID,
                _marketIdsPath[0],
                targetAmountWei
            );
        } else {
            _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferAction(
                TRADE_ACCOUNT_ID,
                ZAP_ACCOUNT_ID,
                _marketIdsPath[0],
                IDolomiteStructs.AssetDenomination.Wei,
                _inputAmountWei
            );
        }

        uint256 tradersPathLength = _tradersPath.length;
        for (uint256 i; i < tradersPathLength; ++i) {
            if (_tradersPath[i].traderType == TraderType.ExternalLiquidity) {
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeExternalSellAction(
                    ZAP_ACCOUNT_ID,
                    _marketIdsPath[i],
                    _marketIdsPath[i + 1],
                    _tradersPath[i].trader,
                    AccountActionLib.all(),
                    _getMinOutputAmountWeiForIndex(_minOutputAmountWei, i, tradersPathLength),
                    _tradersPath[i].tradeData
                );
            } else if (_tradersPath[i].traderType == TraderType.InternalLiquidity) {
                Require.that(
                    DOLOMITE_REGISTRY.isTrustedInternalTrader(_tradersPath[i].trader),
                    _FILE,
                    "Internal trader not whitelisted"
                );

                IInternalAutoTraderBase.InternalTradeParams[] memory trades =
                    _createSwapDataFromTradeParams(
                        _cache,
                        _tradersPath,
                        _accounts,
                        _minOutputAmountWei,
                        i
                    );

                IDolomiteStructs.ActionArgs[] memory tradeActions;
                {
                    IDolomiteStructs.AccountInfo[] memory accounts = _accounts;
                    GenericTraderProxyCache memory cache = _cache;
                    tradeActions = IInternalAutoTraderBase(_tradersPath[i].trader)
                        .createActionsForInternalTrade(
                            IInternalAutoTraderBase.CreateActionsForInternalTradeParams({
                                takerAccountId: ZAP_ACCOUNT_ID,
                                takerAccount: accounts[ZAP_ACCOUNT_ID],
                                feeAccountId: cache.feeTransferAccountIndex,
                                feeAccount: accounts[cache.feeTransferAccountIndex],
                                inputMarketId: _marketIdsPath[i],
                                outputMarketId: _marketIdsPath[i + 1],
                                inputAmountWei: AccountActionLib.all(),
                                trades: trades,
                                extraData: _tradersPath[i].tradeData
                            })
                        );
                }

                for (uint256 j; j < tradeActions.length; ++j) {
                    _actions[_cache.actionsCursor++] = tradeActions[j];
                }
            } else if (_isUnwrapperTraderType(_tradersPath[i].traderType)) {
                // We can't use a Require for the following assert, because there's already an invariant that enforces
                // the trader is an `IsolationModeWrapper` if the market ID at `i + 1` is in isolation mode. Meaning,
                // an unwrapper can never appear at the non-zero index because there is an invariant that checks the
                // `IsolationModeWrapper` is the last index
                assert(i == 0);
                IDolomiteStructs.ActionArgs[] memory unwrapActions =
                    IIsolationModeUnwrapperTraderV2(_tradersPath[i].trader).createActionsForUnwrapping(
                        IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParams({
                            primaryAccountId: ZAP_ACCOUNT_ID,
                            otherAccountId: _otherAccountId(),
                            primaryAccountOwner: _accounts[ZAP_ACCOUNT_ID].owner,
                            primaryAccountNumber: _accounts[ZAP_ACCOUNT_ID].number,
                            otherAccountOwner: _accounts[_otherAccountId()].owner,
                            otherAccountNumber: _accounts[_otherAccountId()].number,
                            outputMarket: _marketIdsPath[i + 1],
                            inputMarket: _marketIdsPath[i],
                            minOutputAmount: _getMinOutputAmountWeiForIndex(
                                _minOutputAmountWei,
                                /* _index = */ i, // solium-disable-line indentation
                                _tradersPath.length
                            ),
                            /* Cannot use ALL since it messes up the actions */
                            inputAmount: _inputAmountWei,
                            orderData: _tradersPath[i].tradeData
                        })
                    );

                for (uint256 j; j < unwrapActions.length; ++j) {
                    _actions[_cache.actionsCursor++] = unwrapActions[j];
                }
            } else {
                // Panic if the developer messed up the `else` statement here
                assert(_isWrapperTraderType(_tradersPath[i].traderType));
                Require.that(
                    i == tradersPathLength - 1,
                    _FILE,
                    "Wrapper must be the last trader"
                );

                IDolomiteStructs.ActionArgs[] memory wrapActions = IIsolationModeWrapperTraderV2(_tradersPath[i].trader)
                    .createActionsForWrapping(
                        IIsolationModeWrapperTraderV2.CreateActionsForWrappingParams({
                            primaryAccountId: ZAP_ACCOUNT_ID,
                            otherAccountId: _otherAccountId(),
                            primaryAccountOwner: _accounts[ZAP_ACCOUNT_ID].owner,
                            primaryAccountNumber: _accounts[ZAP_ACCOUNT_ID].number,
                            otherAccountOwner: _accounts[_otherAccountId()].owner,
                            otherAccountNumber: _accounts[_otherAccountId()].number,
                            outputMarket: _marketIdsPath[i + 1],
                            inputMarket: _marketIdsPath[i],
                            minOutputAmount: _getMinOutputAmountWeiForIndex(
                                _minOutputAmountWei,
                                /* _index = */ i, // solium-disable-line indentation
                                _tradersPath.length
                            ),
                            inputAmount: AccountActionLib.all(),
                            orderData: _tradersPath[i].tradeData
                        })
                    );

                for (uint256 j; j < wrapActions.length; ++j) {
                    _actions[_cache.actionsCursor++] = wrapActions[j];
                }
            }
        }

        // When the trades are finished, transfer all of the outputMarket from the ZAP account to the TRADE account
        _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferAction(
            ZAP_ACCOUNT_ID,
            TRADE_ACCOUNT_ID,
            _marketIdsPath[_marketIdsPath.length - 1],
            IDolomiteStructs.AssetDenomination.Wei,
            AccountActionLib.all()
        );
    }

    /**
     * @return  The index of the account that is not the Zap account. For the liquidation contract, this is
     *          the account being liquidated. For the GenericTrader contract this is the same as the trader account.
     */
    function _otherAccountId() internal pure virtual returns (uint256);

    function _isWrapperTraderType(
        TraderType _traderType
    )
        internal
        pure
        returns (bool)
    {
        return TraderType.IsolationModeWrapper == _traderType;
    }

    function _isUnwrapperTraderType(
        TraderType _traderType
    )
        internal
        pure
        returns (bool)
    {
        return TraderType.IsolationModeUnwrapper == _traderType;
    }

    function _createSwapDataFromTradeParams(
        GenericTraderProxyCache memory _cache,
        TraderParam[] memory _traderParams,
        IDolomiteStructs.AccountInfo[] memory _accounts,
        uint256 _minOutputAmountWei,
        uint256 _index
    ) internal pure returns (IInternalAutoTraderBase.InternalTradeParams[] memory) {
        IInternalAutoTraderBase.InternalTradeParams[] memory trades =
            new IInternalAutoTraderBase.InternalTradeParams[](1);
        trades[0].makerAccount = _accounts[_traderParams[_index].makerAccountIndex + _cache.traderAccountStartIndex];
        trades[0].makerAccountId = _traderParams[_index].makerAccountIndex + _cache.traderAccountStartIndex;
        trades[0].amount = AccountActionLib.all();
        trades[0].minOutputAmount = _getMinOutputAmountWeiForIndex(_minOutputAmountWei, _index, _traderParams.length);
        return trades;
    }

    // ==================== Private Functions ====================

    /// @dev Calculate a randomized sub-account for where the zap occurs (and any intermediate swaps)
    function _calculateZapAccountNumber(
        address _tradeAccountOwner,
        uint256 _tradeAccountNumber
    )
        private
        view
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked(_tradeAccountOwner, _tradeAccountNumber, block.timestamp)));
    }

    function _getMinOutputAmountWeiForIndex(
        uint256 _minOutputAmountWei,
        uint256 _index,
        uint256 _tradersPathLength
    )
        private
        pure
        returns (uint256)
    {
        return _index == _tradersPathLength - 1 ? _minOutputAmountWei : 1;
    }
}
