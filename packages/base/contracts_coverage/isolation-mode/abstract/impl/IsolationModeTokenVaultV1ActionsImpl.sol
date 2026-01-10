// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

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

import { IDolomiteRegistry } from "../../../interfaces/IDolomiteRegistry.sol";
import { IEventEmitterRegistry } from "../../../interfaces/IEventEmitterRegistry.sol";
import { AccountActionLib } from "../../../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../../../lib/AccountBalanceLib.sol";
import { DolomiteMarginVersionWrapperLib } from "../../../lib/DolomiteMarginVersionWrapperLib.sol";
import { InterestIndexLib } from "../../../lib/InterestIndexLib.sol";
import { InternalSafeDelegateCallLib } from "../../../lib/InternalSafeDelegateCallLib.sol";
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { BitsLib } from "../../../protocol/lib/BitsLib.sol";
import { DecimalLib } from "../../../protocol/lib/DecimalLib.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { BaseLiquidatorProxy } from "../../../proxies/BaseLiquidatorProxy.sol";
import { IGenericTraderProxyV2 } from "../../../proxies/interfaces/IGenericTraderProxyV2.sol";
import { IDepositWithdrawalRouter } from "../../../routers/interfaces/IDepositWithdrawalRouter.sol";
import { IIsolationModeTokenVaultV1 } from "../../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../../interfaces/IIsolationModeVaultFactory.sol";


/**
 * @title   IsolationModeTokenVaultV1ActionsImpl
 * @author  Dolomite
 *
 * Reusable library for functions that save bytecode on the async unwrapper/wrapper contracts
 */
library IsolationModeTokenVaultV1ActionsImpl {
    using DecimalLib for uint256;
    using DolomiteMarginVersionWrapperLib for IDolomiteMargin;
    using TypesLib for IDolomiteMargin.Par;
    using TypesLib for IDolomiteMargin.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeVaultV1ActionsImpl";

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function multicall(
        bytes[] memory _calls,
        IDolomiteRegistry _dolomiteRegistry
    ) public {
        bytes4[] memory allowedSelectors = _dolomiteRegistry.isolationModeMulticallFunctions();
        uint256 len = _calls.length;

        for (uint256 i; i < len; ++i) {
            if (selectorBinarySearch( allowedSelectors, getFunctionSelector(_calls[i]) )) { /* FOR COVERAGE TESTING */ }
            Require.that(
                selectorBinarySearch(
                    allowedSelectors,
                    getFunctionSelector(_calls[i])
                ),
                _FILE,
                "Disallowed multicall function"
            );

            InternalSafeDelegateCallLib.safeDelegateCall(address(this), _calls[i]);
        }
    }

    function depositIntoVaultForDolomiteMargin(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _toAccountNumber,
        uint256 _amountWei,
        bool _isViaRouter
    ) public {
        // This implementation requires we deposit into index 0
        _checkToAccountNumberIsZero(_toAccountNumber);

        IIsolationModeVaultFactory factory = IIsolationModeVaultFactory(_vault.VAULT_FACTORY());
        if (_isViaRouter) {
            IDepositWithdrawalRouter router = _vault.dolomiteRegistry().depositWithdrawalRouter();
            router.vaultExecuteDepositUnderlyingToken(
                _vault.marketId(),
                _toAccountNumber,
                _amountWei
            );
        } else {
            factory.depositIntoDolomiteMargin(_toAccountNumber, _amountWei);
        }
    }

    function withdrawFromVaultForDolomiteMargin(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        bool _isViaRouter
    ) public {
        // This implementation requires we withdraw from index 0
        _checkFromAccountNumberIsZero(_fromAccountNumber);

        IIsolationModeVaultFactory factory = IIsolationModeVaultFactory(_vault.VAULT_FACTORY());
        if (_isViaRouter) {
            IDepositWithdrawalRouter depositWithdrawalRouter = _vault.dolomiteRegistry().depositWithdrawalRouter();
            depositWithdrawalRouter.vaultExecuteWithdrawUnderlyingToken(
                _vault.marketId(),
                _fromAccountNumber,
                _amountWei
            );
        } else {
            factory.withdrawFromDolomiteMargin(
                _fromAccountNumber,
                _amountWei
            );
        }
    }

    function openBorrowPosition(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) public {
        _checkFromAccountNumberIsZero(_fromAccountNumber);
        if (_toAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _toAccountNumber != 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );

        _vault.BORROW_POSITION_PROXY().openBorrowPosition(
            _fromAccountNumber,
            _toAccountNumber,
            _vault.marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function openMarginPosition(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _borrowMarketId,
        uint256 _amountWei
    ) public {
        transferIntoPositionWithUnderlyingToken(
            _vault,
            _fromAccountNumber,
            _toAccountNumber,
            _amountWei
        );
        IEventEmitterRegistry.BalanceUpdate memory zeroUpdate;
        IEventEmitterRegistry.BalanceUpdate memory marginDepositUpdate = IEventEmitterRegistry.BalanceUpdate({
            deltaWei: IDolomiteStructs.Wei({
                sign: true,
                value: _amountWei
            }),
            newPar: _vault.DOLOMITE_MARGIN().getAccountPar(
                IDolomiteStructs.AccountInfo({
                    owner: address(this),
                    number: _toAccountNumber
                }),
                _vault.marketId()
            )
        });
        _vault.dolomiteRegistry().eventEmitter().emitMarginPositionOpen(
            address(_vault),
            _toAccountNumber,
            /* _inputToken */ _vault.DOLOMITE_MARGIN().getMarketTokenAddress(_borrowMarketId),
            /* _outputToken */ _vault.VAULT_FACTORY(),
            /* _depositToken */ _vault.VAULT_FACTORY(),
            zeroUpdate,
            marginDepositUpdate,
            marginDepositUpdate
        );
    }

    function closeBorrowPositionWithUnderlyingVaultToken(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    ) public {
        _checkBorrowAccountNumberIsNotZero(_borrowAccountNumber, /* _bypassAccountNumberCheck = */ false);
        _checkToAccountNumberIsZero(_toAccountNumber);

        uint256[] memory collateralMarketIds = new uint256[](1);
        collateralMarketIds[0] = _vault.marketId();

        _vault.BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ address(this),
            _toAccountNumber,
            collateralMarketIds
        );
    }

    function closeBorrowPositionWithOtherTokens(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    ) public {
        _checkBorrowAccountNumberIsNotZero(_borrowAccountNumber, /* _bypassAccountNumberCheck = */ false);
        uint256 underlyingMarketId = _vault.marketId();
        for (uint256 i = 0; i < _collateralMarketIds.length; i++) {
            if (_collateralMarketIds[i] != underlyingMarketId) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _collateralMarketIds[i] != underlyingMarketId,
                _FILE,
                "Cannot withdraw market to wallet",
                underlyingMarketId
            );
        }

        _vault.BORROW_POSITION_PROXY().closeBorrowPositionWithDifferentAccounts(
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            /* _toAccountOwner = */ _vault.OWNER(),
            _toAccountNumber,
            _collateralMarketIds
        );
    }

    function transferIntoPositionWithUnderlyingToken(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    ) public {
        _checkFromAccountNumberIsZero(_fromAccountNumber);
        _checkBorrowAccountNumberIsNotZero(_borrowAccountNumber, /* _bypassAccountNumberCheck = */ false);

        _vault.BORROW_POSITION_PROXY().transferBetweenAccounts(
            _fromAccountNumber,
            _borrowAccountNumber,
            _vault.marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function transferIntoPositionWithOtherToken(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag,
        bool _checkAllowableCollateralMarketFlag,
        bool _bypassAccountNumberCheck,
        bool _fromWallet
    ) public {
        _checkBorrowAccountNumberIsNotZero(_borrowAccountNumber, _bypassAccountNumberCheck);
        _checkMarketIdIsNotSelf(_vault, _marketId);

        if (_fromWallet) {
            _vault.dolomiteRegistry().depositWithdrawalRouter().vaultExecuteDepositOtherToken(
                _marketId,
                _borrowAccountNumber,
                _amountWei
            );
        } else {
            _vault.BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
                /* _fromAccountOwner = */ _vault.OWNER(),
                _fromAccountNumber,
                /* _toAccountOwner = */ address(this),
                _borrowAccountNumber,
                _marketId,
                _amountWei,
                _balanceCheckFlag
            );
        }

        if (_checkAllowableCollateralMarketFlag) {
            _checkAllowableCollateralMarket(
                _vault,
                address(this),
                _borrowAccountNumber,
                _marketId
            );
        }
    }

    function transferFromPositionWithUnderlyingToken(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) public {
        _checkBorrowAccountNumberIsNotZero(_borrowAccountNumber, /* _bypassAccountNumberCheck = */ false);
        _checkToAccountNumberIsZero(_toAccountNumber);

        _vault.BORROW_POSITION_PROXY().transferBetweenAccounts(
            _borrowAccountNumber,
            _toAccountNumber,
            _vault.marketId(),
            _amountWei,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function transferFromPositionWithOtherToken(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag,
        bool _bypassAccountNumberCheck,
        bool _toWallet
    ) public {
        _checkBorrowAccountNumberIsNotZero(_borrowAccountNumber, _bypassAccountNumberCheck);
        _checkMarketIdIsNotSelf(_vault, _marketId);

        if (_toWallet) {
            _vault.dolomiteRegistry().depositWithdrawalRouter().vaultExecuteWithdrawOtherToken(
                _marketId,
                _borrowAccountNumber,
                _amountWei,
                _balanceCheckFlag
            );
        } else {
            _vault.BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
                /* _fromAccountOwner = */ address(this),
                _borrowAccountNumber,
                /* _toAccountOwner = */ _vault.OWNER(),
                _toAccountNumber,
                _marketId,
                _amountWei,
                _balanceCheckFlag
            );
        }

        _checkAllowableDebtMarket(_vault, address(this), _borrowAccountNumber, _marketId);
    }

    function repayAllForBorrowPosition(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) public {
        _checkBorrowAccountNumberIsNotZero(_borrowAccountNumber, /* _bypassAccountNumberCheck = */ false);
        _checkMarketIdIsNotSelf(_vault, _marketId);
        _vault.BORROW_POSITION_PROXY().repayAllForBorrowPositionWithDifferentAccounts(
            /* _fromAccountOwner = */ _vault.OWNER(),
            _fromAccountNumber,
            /* _borrowAccountOwner = */ address(this),
            _borrowAccountNumber,
            _marketId,
            _balanceCheckFlag
        );
    }

    function addCollateralAndSwapExactInputForOutput(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    ) public {
        if (_borrowAccountNumber == 0) {
            uint256 marketId = _vault.marketId();
            if (_marketIdsPath[0] != marketId && _marketIdsPath[_marketIdsPath.length - 1] == marketId) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _marketIdsPath[0] != marketId && _marketIdsPath[_marketIdsPath.length - 1] == marketId,
                _FILE,
                "Invalid marketId for swap/add"
            );
        }

        if (_marketIdsPath[0] == _vault.marketId()) {
            transferIntoPositionWithUnderlyingToken(
                _vault,
                _fromAccountNumber,
                _borrowAccountNumber,
                _inputAmountWei
            );
        } else {
            if (_inputAmountWei == AccountActionLib.all()) {
                _inputAmountWei = _getAndValidateBalanceForAllForMarket(
                    _vault,
                    _vault.OWNER(),
                    _fromAccountNumber,
                    _marketIdsPath[0]
                );
            }
            // we always swap the exact amount out; no need to check `BalanceCheckFlag.To`
            // always skip the checking allowable collateral, since we're immediately trading all of it here
            transferIntoPositionWithOtherToken(
                _vault,
                _fromAccountNumber,
                _borrowAccountNumber,
                _marketIdsPath[0],
                _inputAmountWei,
                AccountBalanceLib.BalanceCheckFlag.From,
                /* _checkAllowableCollateralMarketFlag = */ false,
                /* _bypassAccountNumberCheck = */ true,
                /* _fromWallet = */ false
            );
        }

        swapExactInputForOutput(
            _vault,
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig,
            /* _checkOutputMarketIdFlag = */ true,
            /* _bypassAccountNumberCheck = */ true
        );
    }

    function swapExactInputForOutputAndRemoveCollateral(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    ) public {
        uint256 outputMarketId = _marketIdsPath[_marketIdsPath.length - 1];
        if (_borrowAccountNumber == 0) {
            uint256 marketId = _vault.marketId();
            if (outputMarketId != marketId && _marketIdsPath[0] == marketId) { /* FOR COVERAGE TESTING */ }
            Require.that(
                outputMarketId != marketId && _marketIdsPath[0] == marketId,
                _FILE,
                "Invalid marketId for swap/remove"
            );
        }

        IDolomiteStructs.Wei memory balanceDelta;

        // Create a new scope for stack too deep
        {
            IDolomiteMargin dolomiteMargin = _vault.DOLOMITE_MARGIN();
            IDolomiteStructs.AccountInfo memory borrowAccount = IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            });
            // Validate the output balance before executing the swap
            IDolomiteStructs.Wei memory balanceBefore = dolomiteMargin.getAccountWei(borrowAccount, outputMarketId);

            swapExactInputForOutput(
                _vault,
                _borrowAccountNumber,
                _marketIdsPath,
                _inputAmountWei,
                _minOutputAmountWei,
                _tradersPath,
                _makerAccounts,
                _userConfig,
                /* _checkOutputMarketIdFlag = */ false,
                /* _bypassAccountNumberCheck = */ true
            );

            balanceDelta = dolomiteMargin
                .getAccountWei(borrowAccount, outputMarketId)
                .sub(balanceBefore);
        }

        // Panic if the balance delta is not positive
        /*assert(balanceDelta.isPositive());*/

        if (outputMarketId == _vault.marketId()) {
            transferFromPositionWithUnderlyingToken(
                /* _vault = */ _vault,
                _borrowAccountNumber,
                _toAccountNumber,
                balanceDelta.value
            );
        } else {
            transferFromPositionWithOtherToken(
                /* _vault = */ _vault,
                _borrowAccountNumber,
                _toAccountNumber,
                outputMarketId,
                balanceDelta.value,
                AccountBalanceLib.BalanceCheckFlag.None, // we always transfer the exact amount out; no need to check
                /* _bypassAccountNumberCheck = */ true,
                /* _toWallet = */ false
            );
        }
    }

    function swapExactInputForOutput(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig,
        bool _checkOutputMarketIdFlag,
        bool _bypassAccountNumberCheck
    ) public {
        if (!_bypassAccountNumberCheck) {
            if (_tradeAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _tradeAccountNumber != 0,
                _FILE,
                "Invalid tradeAccountNumber",
                _tradeAccountNumber
            );
        }

        if (_inputAmountWei == AccountActionLib.all()) {
            _inputAmountWei = _getAndValidateBalanceForAllForMarket(
                _vault,
                /* _accountOwner = */ address(_vault),
                _tradeAccountNumber,
                _marketIdsPath[0]
            );
        }

        _vault.dolomiteRegistry().genericTraderProxy().swapExactInputForOutput(
            IGenericTraderProxyV2.SwapExactInputForOutputParams({
                accountNumber: _tradeAccountNumber,
                marketIdsPath: _marketIdsPath,
                inputAmountWei: _inputAmountWei,
                minOutputAmountWei: _minOutputAmountWei,
                tradersPath: _tradersPath,
                makerAccounts: _makerAccounts,
                userConfig: _userConfig
            })
        );

        uint256 inputMarketId = _marketIdsPath[0];
        uint256 outputMarketId = _marketIdsPath[_marketIdsPath.length - 1];
        address tradeAccountOwner = address(this);
        _checkAllowableCollateralMarket(_vault, tradeAccountOwner, _tradeAccountNumber, inputMarketId);
        _checkAllowableDebtMarket(_vault, tradeAccountOwner, _tradeAccountNumber, inputMarketId);
        if (_checkOutputMarketIdFlag) {
            _checkAllowableCollateralMarket(_vault, tradeAccountOwner, _tradeAccountNumber, outputMarketId);
            _checkAllowableDebtMarket(_vault, tradeAccountOwner, _tradeAccountNumber, outputMarketId);
        }
    }

    function validateIsNotLiquidatable(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _accountNumber
    ) public view {
        IDolomiteMargin dolomiteMargin = _vault.DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory liquidAccount = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _accountNumber
        });
        uint256[] memory marketsWithBalances = dolomiteMargin.getAccountMarketsWithBalances(liquidAccount);
        BaseLiquidatorProxy.MarketInfo[] memory marketInfos = _getMarketInfos(
            dolomiteMargin,
            /* _solidMarketIds = */ new uint256[](0),
            marketsWithBalances
        );
        (
            IDolomiteStructs.MonetaryValue memory liquidSupplyValue,
            IDolomiteStructs.MonetaryValue memory liquidBorrowValue
        ) = _getAdjustedAccountValues(
            dolomiteMargin,
            marketInfos,
            liquidAccount,
            marketsWithBalances
        );

        IDolomiteStructs.Decimal memory marginRatio = dolomiteMargin.getMarginRatio();
        if (dolomiteMargin.getAccountStatus(liquidAccount) != IDolomiteStructs.AccountStatus.Liquid && _isCollateralized(liquidSupplyValue.value, liquidBorrowValue.value, marginRatio)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            dolomiteMargin.getAccountStatus(liquidAccount) != IDolomiteStructs.AccountStatus.Liquid
                && _isCollateralized(liquidSupplyValue.value, liquidBorrowValue.value, marginRatio),
            _FILE,
            "Account liquidatable"
        );
    }

    function getFunctionSelector(bytes memory _call) public pure returns (bytes4 result) {
        if (_call.length >= 4) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _call.length >= 4,
            _FILE,
            "Invalid calldata length"
        );

        // The bytes4 keyword casts a byte array (in memory) to a fixed-size byte array
        assembly {
            // load the 2nd word from original (1st word is length) and store it in the result
            result := mload(add(_call, 32))
        }
    }

    function selectorBinarySearch(bytes4[] memory _allowedSelectors, bytes4 _selector) public pure returns (bool) {
        if (_allowedSelectors.length == 0) {
            return false;
        }

        uint256 low = 0;
        uint256 high = _allowedSelectors.length - 1;
        if (_selector < _allowedSelectors[low] || _selector > _allowedSelectors[high]) {
            return false;
        }
        while (low <= high) {
            uint256 mid = (low + high) / 2;
            if (_allowedSelectors[mid] == _selector) {
                return true;
            } else if (_allowedSelectors[mid] < _selector) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return false;
    }

    // ===================================================
    // ==================== Private ======================
    // ===================================================

    function _getAndValidateBalanceForAllForMarket(
        IIsolationModeTokenVaultV1 _vault,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) private view returns (uint256) {
        IDolomiteStructs.Wei memory balanceWei = _vault.DOLOMITE_MARGIN().getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balanceWei.isPositive()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            balanceWei.isPositive(),
            _FILE,
            "Invalid balance for transfer all"
        );
        return balanceWei.value;
    }

    function _checkAllowableCollateralMarket(
        IIsolationModeTokenVaultV1 _vault,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) private view {
        // If the balance is positive, check that the collateral is for an allowable market. We use the Par balance
        // because, it uses less gas than getting the Wei balance, and we're only checking whether the balance is
        // positive.
        IDolomiteStructs.Par memory balancePar = _vault.DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isPositive()) {
            // Check the allowable collateral markets for the position:
            IIsolationModeVaultFactory vaultFactory = IIsolationModeVaultFactory(_vault.VAULT_FACTORY());
            uint256[] memory allowableCollateralMarketIds = vaultFactory.allowableCollateralMarketIds();
            uint256 allowableCollateralsLength = allowableCollateralMarketIds.length;
            if (allowableCollateralsLength != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableCollateralsLength; i++) {
                    if (allowableCollateralMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                if (isAllowable) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    isAllowable,
                    _FILE,
                    "Market not allowed as collateral",
                    _marketId
                );
            }
        }
    }

    function _checkAllowableDebtMarket(
        IIsolationModeTokenVaultV1 _vault,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId
    ) private view {
        // If the balance is negative, check that the debt is for an allowable market. We use the Par balance because,
        // it uses less gas than getting the Wei balance, and we're only checking whether the balance is negative.
        IDolomiteStructs.Par memory balancePar = _vault.DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _accountOwner,
                number: _accountNumber
            }),
            _marketId
        );
        if (balancePar.isNegative()) {
            // Check the allowable debt markets for the position:
            IIsolationModeVaultFactory vaultFactory = IIsolationModeVaultFactory(_vault.VAULT_FACTORY());
            uint256[] memory allowableDebtMarketIds = vaultFactory.allowableDebtMarketIds();
            if (allowableDebtMarketIds.length != 0) {
                bool isAllowable = false;
                for (uint256 i = 0; i < allowableDebtMarketIds.length; i++) {
                    if (allowableDebtMarketIds[i] == _marketId) {
                        isAllowable = true;
                        break;
                    }
                }
                if (isAllowable) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    isAllowable,
                    _FILE,
                    "Market not allowed as debt",
                    _marketId
                );
            }
        }
    }

    function _checkMarketIdIsNotSelf(
        IIsolationModeTokenVaultV1 _vault,
        uint256 _marketId
    ) private view {
        if (_marketId != _vault.marketId()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _marketId != _vault.marketId(),
            _FILE,
            "Invalid marketId",
            _marketId
        );
    }

    function _getAdjustedAccountValues(
        IDolomiteMargin _dolomiteMargin,
        BaseLiquidatorProxy.MarketInfo[] memory _marketInfos,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds
    )
        internal
        view
        returns (
            IDolomiteStructs.MonetaryValue memory supplyValue,
            IDolomiteStructs.MonetaryValue memory borrowValue
        )
    {
        return _getAccountValues(
            _dolomiteMargin,
            _marketInfos,
            _account,
            _marketIds,
            /* _adjustForMarginPremiums = */ true
        );
    }

    function _getAccountValues(
        IDolomiteMargin _dolomiteMargin,
        BaseLiquidatorProxy.MarketInfo[] memory _marketInfos,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds,
        bool _adjustForMarginPremiums
    )
        internal
        view
        returns (
            IDolomiteStructs.MonetaryValue memory,
            IDolomiteStructs.MonetaryValue memory
        )
    {
        IDolomiteStructs.MonetaryValue memory supplyValue = IDolomiteStructs.MonetaryValue(0);
        IDolomiteStructs.MonetaryValue memory borrowValue = IDolomiteStructs.MonetaryValue(0);
        for (uint256 i; i < _marketIds.length; ++i) {
            IDolomiteStructs.Par memory par = _dolomiteMargin.getAccountPar(_account, _marketIds[i]);
            BaseLiquidatorProxy.MarketInfo memory marketInfo = _binarySearch(_marketInfos, _marketIds[i]);
            IDolomiteStructs.Wei memory userWei = InterestIndexLib.parToWei(par, marketInfo.index);
            uint256 assetValue = userWei.value * marketInfo.price.value;
            IDolomiteStructs.Decimal memory marginPremium = DecimalLib.one();
            if (_adjustForMarginPremiums) {
                marginPremium = DecimalLib.onePlus(_dolomiteMargin.getMarketMarginPremium(_marketIds[i]));
            }
            if (userWei.sign) {
                supplyValue.value = supplyValue.value + DecimalLib.div(assetValue, marginPremium);
            } else {
                borrowValue.value = borrowValue.value + DecimalLib.mul(assetValue, marginPremium);
            }
        }
        return (supplyValue, borrowValue);
    }

    function _getMarketInfos(
        IDolomiteMargin _dolomiteMargin,
        uint256[] memory _solidMarketIds,
        uint256[] memory _liquidMarketIds
    ) internal view returns (BaseLiquidatorProxy.MarketInfo[] memory) {
        uint[] memory marketBitmaps = BitsLib.createBitmaps(_dolomiteMargin.getNumMarkets());
        uint256 marketsLength = 0;
        marketsLength = _addMarketsToBitmap(_solidMarketIds, marketBitmaps, marketsLength);
        marketsLength = _addMarketsToBitmap(_liquidMarketIds, marketBitmaps, marketsLength);

        uint256 counter = 0;
        BaseLiquidatorProxy.MarketInfo[] memory marketInfos = new BaseLiquidatorProxy.MarketInfo[](marketsLength);
        for (uint256 i; i < marketBitmaps.length && counter != marketsLength; ++i) {
            uint256 bitmap = marketBitmaps[i];
            while (bitmap != 0) {
                uint256 nextSetBit = BitsLib.getLeastSignificantBit(bitmap);
                uint256 marketId = BitsLib.getMarketIdFromBit(i, nextSetBit);

                marketInfos[counter++] = BaseLiquidatorProxy.MarketInfo({
                    marketId: marketId,
                    price: _dolomiteMargin.getMarketPrice(marketId),
                    index: _dolomiteMargin.getMarketCurrentIndex(marketId)
                });

                // unset the set bit
                bitmap = BitsLib.unsetBit(bitmap, nextSetBit);
            }
        }

        return marketInfos;
    }

    function _checkFromAccountNumberIsZero(uint256 _fromAccountNumber) private pure {
        if (_fromAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _fromAccountNumber == 0,
            _FILE,
            "Invalid fromAccountNumber",
            _fromAccountNumber
        );
    }

    function _checkToAccountNumberIsZero(uint256 _toAccountNumber) private pure {
        if (_toAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _toAccountNumber == 0,
            _FILE,
            "Invalid toAccountNumber",
            _toAccountNumber
        );
    }

    function _checkBorrowAccountNumberIsNotZero(
        uint256 _borrowAccountNumber,
        bool _bypassAccountNumberCheck
    ) private pure {
        if (!_bypassAccountNumberCheck) {
            if (_borrowAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _borrowAccountNumber != 0,
                _FILE,
                "Invalid borrowAccountNumber",
                _borrowAccountNumber
            );
        }
    }

    function _addMarketsToBitmap(
        uint256[] memory _markets,
        uint256[] memory _bitmaps,
        uint256 _marketsLength
    ) private pure returns (uint) {
        for (uint256 i; i < _markets.length; ++i) {
            if (!BitsLib.hasBit(_bitmaps, _markets[i])) {
                BitsLib.setBit(_bitmaps, _markets[i]);
                _marketsLength += 1;
            }
        }
        return _marketsLength;
    }

    function _binarySearch(
        BaseLiquidatorProxy.MarketInfo[] memory _markets,
        uint256 _marketId
    ) internal pure returns (BaseLiquidatorProxy.MarketInfo memory) {
        return _binarySearch(
            _markets,
            /* _beginInclusive = */ 0,
            _markets.length,
            _marketId
        );
    }

    function _binarySearch(
        BaseLiquidatorProxy.MarketInfo[] memory _markets,
        uint256 _beginInclusive,
        uint256 _endExclusive,
        uint256 _marketId
    ) internal pure returns (BaseLiquidatorProxy.MarketInfo memory) {
        uint256 len = _endExclusive - _beginInclusive;
        if (len == 0 || (len == 1 && _markets[_beginInclusive].marketId != _marketId)) {
            revert("BaseLiquidatorProxy: Market not found"); // solhint-disable-line reason-string
        }

        uint256 mid = _beginInclusive + len / 2;
        uint256 midMarketId = _markets[mid].marketId;
        if (_marketId < midMarketId) {
            return _binarySearch(
                _markets,
                _beginInclusive,
                mid,
                _marketId
            );
        } else if (_marketId > midMarketId) {
            return _binarySearch(
                _markets,
                mid + 1,
                _endExclusive,
                _marketId
            );
        } else {
            return _markets[mid];
        }
    }

    function _isCollateralized(
        uint256 _supplyValue,
        uint256 _borrowValue,
        IDolomiteStructs.Decimal memory _ratio
    )
        private
        pure
        returns (bool)
    {
        uint256 requiredMargin = DecimalLib.mul(_borrowValue, _ratio);
        return _supplyValue >= _borrowValue + requiredMargin;
    }
}
