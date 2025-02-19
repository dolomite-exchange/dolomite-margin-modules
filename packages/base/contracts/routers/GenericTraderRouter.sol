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

import { RouterBase } from "./RouterBase.sol";
import { IIsolationModeTokenVaultV1 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IGenericTraderProxyV2 } from "../proxies/interfaces/IGenericTraderProxyV2.sol";
import { IGenericTraderRouter } from "./interfaces/IGenericTraderRouter.sol";


/**
 * @title   GenericTraderRouter
 * @author  Dolomite
 *
 * @notice  Router contract for trading assets
 */
contract GenericTraderRouter is RouterBase, IGenericTraderRouter {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "GenericTraderRouter";

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function swapExactInputForOutput(
        uint256 _isolationModeMarketId,
        IGenericTraderProxyV2.SwapExactInputForOutputParams memory _params
    ) external payable nonReentrant {
        if (_isolationModeMarketId == 0) {
            Require.that(
                msg.value == 0,
                _FILE,
                'msg.value must be 0'
            );
            IGenericTraderProxyV2 proxy = IGenericTraderProxyV2(address(DOLOMITE_REGISTRY.genericTraderProxy()));
            proxy.swapExactInputForOutputForDifferentAccount(
                /* _accountOwner = */ msg.sender,
                _params
            );
        } else {
            MarketInfo memory marketInfo = _getMarketInfo(_isolationModeMarketId);
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(marketInfo, msg.sender);

            if (
                _params.marketIdsPath[_params.marketIdsPath.length - 1] == _isolationModeMarketId
                && isDolomiteBalance(_params.accountNumber)
            ) {
                // We need to move funds from the user to the vault and perform the swap
                vault.addCollateralAndSwapExactInputForOutput{ value: msg.value }(
                    _params.accountNumber,
                    /* toAccountNumber */ DEFAULT_ACCOUNT_NUMBER,
                    _params.marketIdsPath,
                    _params.inputAmountWei,
                    _params.minOutputAmountWei,
                    _params.tradersPath,
                    _params.makerAccounts,
                    _params.userConfig
                );
            } else if (_params.marketIdsPath[0] == _isolationModeMarketId && isDolomiteBalance(_params.accountNumber)) {
                // We need to move funds from the vault to the user and perform the swap
                vault.swapExactInputForOutputAndRemoveCollateral{ value: msg.value }(
                    _params.accountNumber,
                    /* fromAccountNumber */ DEFAULT_ACCOUNT_NUMBER,
                    _params.marketIdsPath,
                    _params.inputAmountWei,
                    _params.minOutputAmountWei,
                    _params.tradersPath,
                    _params.makerAccounts,
                    _params.userConfig
                );
            } else {
                vault.swapExactInputForOutput{ value: msg.value }(
                    _params.accountNumber,
                    _params.marketIdsPath,
                    _params.inputAmountWei,
                    _params.minOutputAmountWei,
                    _params.tradersPath,
                    _params.makerAccounts,
                    _params.userConfig
                );
            }
      }
    }

    function swapExactInputForOutputAndModifyPosition(
        uint256 _isolationModeMarketId,
        IGenericTraderProxyV2.SwapExactInputForOutputAndModifyPositionParams memory _params
    ) external payable nonReentrant {
        if (_isolationModeMarketId == 0) {
            Require.that(
                msg.value == 0,
                _FILE,
                'msg.value must be 0'
            );
            IGenericTraderProxyV2 proxy = IGenericTraderProxyV2(address(DOLOMITE_REGISTRY.genericTraderProxy()));
            proxy.swapExactInputForOutputAndModifyPositionForDifferentAccount(
                msg.sender,
                _params
            );
        } else {
            MarketInfo memory marketInfo = _getMarketInfo(_isolationModeMarketId);
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(marketInfo, msg.sender);

            if (_checkAddCollateralAndSwap(_params)) {
                vault.addCollateralAndSwapExactInputForOutput{ value: msg.value }(
                    _params.transferCollateralParams.fromAccountNumber,
                    _params.transferCollateralParams.toAccountNumber,
                    _params.marketIdsPath,
                    _params.inputAmountWei,
                    _params.minOutputAmountWei,
                    _params.tradersPath,
                    _params.makerAccounts,
                    _params.userConfig
                );
            } else if (_checkSwapAndRemoveCollateral(_params)) {
                vault.swapExactInputForOutputAndRemoveCollateral{ value: msg.value }(
                    _params.transferCollateralParams.toAccountNumber,
                    _params.transferCollateralParams.fromAccountNumber,
                    _params.marketIdsPath,
                    _params.inputAmountWei,
                    _params.minOutputAmountWei,
                    _params.tradersPath,
                    _params.makerAccounts,
                    _params.userConfig
                );
            } else if (
                isDolomiteBalance(_params.transferCollateralParams.fromAccountNumber)
                && !isDolomiteBalance(_params.transferCollateralParams.toAccountNumber)
            ) {
                // Do the transfers into the position before the swap
                _doTransfers(
                    _isolationModeMarketId,
                    vault,
                    _params.transferCollateralParams,
                    TransferType.IntoPosition
                );
                vault.swapExactInputForOutput{ value: msg.value }(
                    _params.accountNumber,
                    _params.marketIdsPath,
                    _params.inputAmountWei,
                    _params.minOutputAmountWei,
                    _params.tradersPath,
                    _params.makerAccounts,
                    _params.userConfig
                );
            } else {
                assert(
                    !isDolomiteBalance(_params.transferCollateralParams.fromAccountNumber)
                    && isDolomiteBalance(_params.transferCollateralParams.toAccountNumber)
                );

                // Do the transfers into the position after the swap
                vault.swapExactInputForOutput{ value: msg.value }(
                    _params.accountNumber,
                    _params.marketIdsPath,
                    _params.inputAmountWei,
                    _params.minOutputAmountWei,
                    _params.tradersPath,
                    _params.makerAccounts,
                    _params.userConfig
                );
                _doTransfers(
                    _isolationModeMarketId,
                    vault,
                    _params.transferCollateralParams,
                    TransferType.OutOfPosition
                );
            }
        }
    }

    function _doTransfers(
        uint256 _isolationModeMarketId,
        IIsolationModeTokenVaultV1 _vault,
        IGenericTraderProxyV2.TransferCollateralParam memory _params,
        TransferType _transferType
    ) internal {
        for (uint256 i; i < _params.transferAmounts.length; i++) {
            if (_params.transferAmounts[i].marketId == _isolationModeMarketId) {
                if (_transferType == TransferType.IntoPosition) {
                    _vault.transferIntoPositionWithUnderlyingToken(
                        _params.fromAccountNumber,
                        _params.toAccountNumber,
                        _params.transferAmounts[i].amountWei
                    );
                } else {
                    _vault.transferFromPositionWithUnderlyingToken(
                        _params.fromAccountNumber,
                        _params.toAccountNumber,
                        _params.transferAmounts[i].amountWei
                    );
                }
            } else {
                assert(_params.transferAmounts[i].marketId != _isolationModeMarketId);

                if (_transferType == TransferType.IntoPosition) {
                    _vault.transferIntoPositionWithOtherToken(
                        _params.fromAccountNumber,
                        _params.toAccountNumber,
                        _params.transferAmounts[i].marketId,
                        _params.transferAmounts[i].amountWei,
                        AccountBalanceLib.BalanceCheckFlag.From
                    );
                } else {
                    _vault.transferFromPositionWithOtherToken(
                        _params.fromAccountNumber,
                        _params.toAccountNumber,
                        _params.transferAmounts[i].marketId,
                        _params.transferAmounts[i].amountWei,
                        AccountBalanceLib.BalanceCheckFlag.From
                    );
                }
            }
        }
    }

    function _checkAddCollateralAndSwap(
        IGenericTraderProxyV2.SwapExactInputForOutputAndModifyPositionParams memory _params
    ) internal pure returns (bool) {
        return (
            _params.transferCollateralParams.transferAmounts.length == 1
                && isDolomiteBalance(_params.transferCollateralParams.fromAccountNumber)
                && !isDolomiteBalance(_params.transferCollateralParams.toAccountNumber)
        );
    }

    function _checkSwapAndRemoveCollateral(
        IGenericTraderProxyV2.SwapExactInputForOutputAndModifyPositionParams memory _params
    ) internal pure returns (bool) {
        return (
            _params.transferCollateralParams.transferAmounts.length == 1
                && !isDolomiteBalance(_params.transferCollateralParams.fromAccountNumber)
                && isDolomiteBalance(_params.transferCollateralParams.toAccountNumber)
        );
    }
}
