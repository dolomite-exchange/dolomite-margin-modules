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
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   GenericTraderRouter
 * @author  Dolomite
 *
 * @notice  Router contract for trading assets
 */
contract GenericTraderRouter is RouterBase, IGenericTraderRouter {
    using SafeERC20 for IERC20;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "GenericTraderRouter";

    uint256 internal constant TRADE_ACCOUNT_ID = 0;

    uint256 public immutable CHAIN_ID;

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor(
        uint256 _chainId,
        address _dolomiteRegistry
    ) RouterBase(_dolomiteRegistry) {
        CHAIN_ID = _chainId;
    }

    function initialize() public initializer override {
        RouterBase.initialize();
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function swapExactInputForOutput(
        uint256 _isolationModeMarketId,
        IGenericTraderProxyV2.SwapExactInputForOutputParams memory _params
    ) external payable nonReentrant {
        if (_isolationModeMarketId == 0) {
            if (msg.value == 0) { /* FOR COVERAGE TESTING */ }
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
            if (msg.value == 0) { /* FOR COVERAGE TESTING */ }
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
                /*assert(
                    !isDolomiteBalance(_params.transferCollateralParams.fromAccountNumber)
                    && isDolomiteBalance(_params.transferCollateralParams.toAccountNumber)
                );*/

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

    function swapExactInputForOutputViaSmartDebt(
        address _inputToken,
        address _outputToken,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        SmartAssetSwapParams[] memory _swaps
    ) external nonReentrant {
        uint256 inputMarketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_inputToken);
        uint256 outputMarketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_outputToken);
        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(
            _swaps,
            msg.sender,
            _calculateZapAccountNumber(msg.sender)
        );
        _validateZapAccount(accounts[TRADE_ACCOUNT_ID], inputMarketId, outputMarketId);

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            _swaps.length + 2
        );

        IERC20(_inputToken).safeTransferFrom(msg.sender, address(this), _inputAmountWei);
        IERC20(_inputToken).safeApprove(address(DOLOMITE_MARGIN()), _inputAmountWei);
        actions[0] = AccountActionLib.encodeDepositAction(
            TRADE_ACCOUNT_ID,
            inputMarketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _inputAmountWei
            }),
            address(this)
        );

        uint256 tradeTotal;
        for (uint256 i; i < _swaps.length; i++) {
            tradeTotal += _swaps[i].amount;
            actions[i + 1] = AccountActionLib.encodeInternalTradeActionWithCustomData(
                i + 1,
                TRADE_ACCOUNT_ID,
                inputMarketId,
                outputMarketId,
                address(DOLOMITE_REGISTRY.smartDebtTrader()),
                _swaps[i].amount,
                CHAIN_ID,
                false,
                bytes("")
            );
        }
        if (tradeTotal == _inputAmountWei) { /* FOR COVERAGE TESTING */ }
        Require.that(
            tradeTotal == _inputAmountWei,
            _FILE,
            'tradeTotal != _inputAmountWei'
        );

        actions[actions.length - 1] = AccountActionLib.encodeWithdrawalAction(
            TRADE_ACCOUNT_ID,
            outputMarketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Target,
                value: 0
            }),
            address(this)
        );

        DOLOMITE_MARGIN().operate(accounts, actions);

        IERC20(_outputToken).safeTransfer(msg.sender, IERC20(_outputToken).balanceOf(address(this)));
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
                /*assert(_params.transferAmounts[i].marketId != _isolationModeMarketId);*/

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

    function _getAccounts(
        SmartAssetSwapParams[] memory _swaps,
        address _tradeAccountOwner,
        uint256 _tradeAccountNumber
    )
        internal
        pure
        returns (IDolomiteStructs.AccountInfo[] memory)
    {
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](
            _swaps.length + 1
        );
        accounts[TRADE_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _tradeAccountOwner,
            number: _tradeAccountNumber
        });

        for (uint256 i; i < _swaps.length; i++) {
            accounts[i + 1] = IDolomiteStructs.AccountInfo({
                owner: _swaps[i].user,
                number: _swaps[i].accountNumber
            });
        }

        return accounts;
    }

    function _calculateZapAccountNumber(address _user) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(_user, block.timestamp)));
    }

    function _validateZapAccount(
        IDolomiteStructs.AccountInfo memory _account,
        uint256 _inputMarketId,
        uint256 _outputMarketId
    ) internal view {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        /*assert(dolomiteMargin.getAccountPar(_account, _inputMarketId).value == 0);*/
        /*assert(dolomiteMargin.getAccountPar(_account, _outputMarketId).value == 0);*/
    }
}
