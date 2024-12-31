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

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IIsolationModeUnwrapperTraderV2 } from "../isolation-mode/interfaces/IIsolationModeUnwrapperTraderV2.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IIsolationModeWrapperTraderV2 } from "../isolation-mode/interfaces/IIsolationModeWrapperTraderV2.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";


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

    uint256 internal constant ARBITRUM_ONE = 42161;
    bytes32 internal constant DOLOMITE_FS_GLP_HASH = keccak256(bytes("Dolomite: Fee + Staked GLP"));
    string internal constant DOLOMITE_ISOLATION_PREFIX = "Dolomite Isolation:";

    /// @dev The index of the trade account in the accounts array (for executing an operation)
    uint256 internal constant TRADE_ACCOUNT_ID = 0;
    uint256 internal constant ZAP_ACCOUNT_ID = 1;

    uint256 public immutable CHAIN_ID;

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        uint256 _chainId
    ) {
        CHAIN_ID = _chainId;
    }

    function isIsolationModeMarket(IDolomiteMargin _dolomiteMargin, uint256 _marketId) public view returns (bool) {
        return _isIsolationModeAsset(_dolomiteMargin.getMarketTokenAddress(_marketId));
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _isIsolationModeAsset(address _token) internal view returns (bool) {
        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            _token,
            IERC20Metadata(address(0)).name.selector,
            bytes("")
        );
        if (!isSuccess) {
            return false;
        }

        string memory name = abi.decode(returnData, (string));
        if (keccak256(bytes(name)) == DOLOMITE_FS_GLP_HASH) {
            return true;
        }
        return _startsWith(DOLOMITE_ISOLATION_PREFIX, name);
    }

    function _startsWith(string memory _start, string memory _str) internal pure returns (bool) {
        if (bytes(_start).length > bytes(_str).length) {
            return false;
        }

        bytes32 hash;
        assembly {
            let size := mload(_start)
            hash := keccak256(add(_str, 32), size)
        }
        return hash == keccak256(bytes(_start));
    }

    function _validateMarketIdPath(
        uint256[] memory _marketIdsPath
    ) internal pure {
        if (_marketIdsPath.length >= 2) { /* FOR COVERAGE TESTING */ }
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
        if (_inputAmountWei != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmountWei != 0,
            _FILE,
            "Invalid inputAmountWei"
        );
        if (_minOutputAmountWei != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _minOutputAmountWei != 0,
            _FILE,
            "Invalid minOutputAmountWei"
        );
    }

    function _validateTraderParams(
        GenericTraderProxyCache memory _cache,
        uint256[] memory _marketIdsPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        TraderParam[] memory _traderParamsPath
    )
        internal
        view
    {
        if (_marketIdsPath.length == _traderParamsPath.length + 1) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _marketIdsPath.length == _traderParamsPath.length + 1,
            _FILE,
            "Invalid traders params length"
        );

        uint256 traderParamsPathLength = _traderParamsPath.length;
        for (uint256 i; i < traderParamsPathLength; ++i) {
            _validateTraderParam(
                _cache,
                _marketIdsPath,
                _makerAccounts,
                _traderParamsPath[i],
                /* _index = */ i // solium-disable-line indentation
            );
        }
    }

    function _validateTraderParam(
        GenericTraderProxyCache memory _cache,
        uint256[] memory _marketIdsPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        TraderParam memory _traderParam,
        uint256 _index
    )
        internal
        view
    {
        if (_traderParam.trader != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _traderParam.trader != address(0),
            _FILE,
            "Invalid trader at index",
            _index
        );

        uint256 marketId = _marketIdsPath[_index];
        uint256 nextMarketId = _marketIdsPath[_index + 1];
        _validateIsolationModeStatusForTraderParam(
            _cache,
            marketId,
            nextMarketId,
            _traderParam
        );
        _validateTraderTypeForTraderParam(
            _cache,
            marketId,
            nextMarketId,
            _traderParam,
            _index
        );
        _validateMakerAccountForTraderParam(
            _makerAccounts,
            _traderParam,
            _index
        );
    }

    function _validateIsolationModeStatusForTraderParam(
        GenericTraderProxyCache memory _cache,
        uint256 _marketId,
        uint256 _nextMarketId,
        TraderParam memory _traderParam
    ) internal view {
        if (isIsolationModeMarket(_cache.dolomiteMargin, _marketId)) {
            // If the current market is in isolation mode, the trader type must be for isolation mode assets
            if (_isUnwrapperTraderType(_traderParam.traderType)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _isUnwrapperTraderType(_traderParam.traderType),
                _FILE,
                "Invalid isolation mode unwrapper",
                _marketId,
                uint256(uint8(_traderParam.traderType))
            );

            if (isIsolationModeMarket(_cache.dolomiteMargin, _nextMarketId)) {
                // If the user is unwrapping into an isolation mode asset, the next market must trust this trader
                address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId);
                if (IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                    _FILE,
                    "Invalid unwrap sequence",
                    _marketId,
                    _nextMarketId
                );
            }
        } else if (isIsolationModeMarket(_cache.dolomiteMargin, _nextMarketId)) {
            // If the next market is in isolation mode, the trader must wrap the current asset into the isolation asset.
            if (_isWrapperTraderType(_traderParam.traderType)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _isWrapperTraderType(_traderParam.traderType),
                _FILE,
                "Invalid isolation mode wrapper",
                _nextMarketId,
                uint256(uint8(_traderParam.traderType))
            );
        } else {
            // If neither asset is in isolation mode, the trader type must be for non-isolation mode assets
            if (_traderParam.traderType == TraderType.ExternalLiquidity || _traderParam.traderType == TraderType.InternalLiquidity) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _traderParam.traderType == TraderType.ExternalLiquidity
                    || _traderParam.traderType == TraderType.InternalLiquidity,
                _FILE,
                "Invalid trader type",
                uint256(uint8(_traderParam.traderType))
            );
        }
    }

    function _validateTraderTypeForTraderParam(
        GenericTraderProxyCache memory _cache,
        uint256 _marketId,
        uint256 _nextMarketId,
        TraderParam memory _traderParam,
        uint256 _index
    ) internal view {
        if (_isUnwrapperTraderType(_traderParam.traderType)) {
            IIsolationModeUnwrapperTraderV2 unwrapperTrader = IIsolationModeUnwrapperTraderV2(_traderParam.trader);
            address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_marketId);
            if (unwrapperTrader.token() == isolationModeToken) { /* FOR COVERAGE TESTING */ }
            Require.that(
                unwrapperTrader.token() == isolationModeToken,
                _FILE,
                "Invalid input for unwrapper",
                _index,
                _marketId
            );
            if (unwrapperTrader.isValidOutputToken(_cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId))) { /* FOR COVERAGE TESTING */ }
            Require.that(
                unwrapperTrader.isValidOutputToken(_cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId)),
                _FILE,
                "Invalid output for unwrapper",
                _index + 1,
                _nextMarketId
            );
            if (IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                _FILE,
                "Unwrapper trader not enabled",
                _traderParam.trader,
                _marketId
            );
        } else if (_isWrapperTraderType(_traderParam.traderType)) {
            IIsolationModeWrapperTraderV2 wrapperTrader = IIsolationModeWrapperTraderV2(_traderParam.trader);
            address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId);
            if (wrapperTrader.isValidInputToken(_cache.dolomiteMargin.getMarketTokenAddress(_marketId))) { /* FOR COVERAGE TESTING */ }
            Require.that(
                wrapperTrader.isValidInputToken(_cache.dolomiteMargin.getMarketTokenAddress(_marketId)),
                _FILE,
                "Invalid input for wrapper",
                _index,
                _marketId
            );
            if (wrapperTrader.token() == isolationModeToken) { /* FOR COVERAGE TESTING */ }
            Require.that(
                wrapperTrader.token() == isolationModeToken,
                _FILE,
                "Invalid output for wrapper",
                _index + 1,
                _nextMarketId
            );
            if (IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                IIsolationModeVaultFactory(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                _FILE,
                "Wrapper trader not enabled",
                _traderParam.trader,
                _nextMarketId
            );
        }
    }

    function _validateMakerAccountForTraderParam(
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        TraderParam memory _traderParam,
        uint256 _index
    ) internal pure {
        if (TraderType.InternalLiquidity == _traderParam.traderType) {
            // The makerAccountOwner should be set if the traderType is InternalLiquidity
            if (_traderParam.makerAccountIndex < _makerAccounts.length && _makerAccounts[_traderParam.makerAccountIndex].owner != address(0)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _traderParam.makerAccountIndex < _makerAccounts.length
                && _makerAccounts[_traderParam.makerAccountIndex].owner != address(0),
                _FILE,
                "Invalid maker account owner",
                _index
            );
        } else {
            // The makerAccountOwner and makerAccountNumber is not used if the traderType is not InternalLiquidity
            if (_traderParam.makerAccountIndex == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _traderParam.makerAccountIndex == 0,
                _FILE,
                "Invalid maker account owner",
                _index
            );
        }
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
            /*assert(_cache.dolomiteMargin.getAccountPar(_account, _marketIdsPath[i]).value == 0);*/
        }
    }

    function _getAccounts(
        GenericTraderProxyCache memory _cache,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        address _tradeAccountOwner,
        uint256 _tradeAccountNumber
    )
        internal
        view
        returns (IDolomiteStructs.AccountInfo[] memory)
    {
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
            /*assert(account.owner == address(0) && account.number == 0);*/

            _accounts[_cache.traderAccountStartIndex + i] = IDolomiteStructs.AccountInfo({
                owner: _makerAccounts[i].owner,
                number: _makerAccounts[i].number
            });
        }
    }

    function _getActionsLengthForTraderParams(
        TraderParam[] memory _tradersPath
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
                uint256 customInputAmountWei = AccountActionLib.all();
                bytes memory tradeData = _tradersPath[i].tradeData;
                if (CHAIN_ID == ARBITRUM_ONE) {
                    (
                        customInputAmountWei,
                        tradeData
                    ) = abi.decode(tradeData, (uint256, bytes));
                    if ((i == 0 && customInputAmountWei == _inputAmountWei) || i != 0) { /* FOR COVERAGE TESTING */ }
                    Require.that(
                        (i == 0 && customInputAmountWei == _inputAmountWei) || i != 0,
                        _FILE,
                        "Invalid custom input amount"
                    );
                }
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeInternalTradeActionWithCustomData(
                    ZAP_ACCOUNT_ID,
                    /* _makerAccountId = */ _tradersPath[i].makerAccountIndex + _cache.traderAccountStartIndex,
                    _marketIdsPath[i],
                    _marketIdsPath[i + 1],
                    _tradersPath[i].trader,
                    customInputAmountWei,
                    tradeData
                );
            } else if (_isUnwrapperTraderType(_tradersPath[i].traderType)) {
                // We can't use a Require for the following assert, because there's already an invariant that enforces
                // the trader is an `IsolationModeWrapper` if the market ID at `i + 1` is in isolation mode. Meaning,
                // an unwrapper can never appear at the non-zero index because there is an invariant that checks the
                // `IsolationModeWrapper` is the last index
                /*assert(i == 0);*/
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
                /*assert(_isWrapperTraderType(_tradersPath[i].traderType));*/
                if (i == tradersPathLength - 1) { /* FOR COVERAGE TESTING */ }
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
