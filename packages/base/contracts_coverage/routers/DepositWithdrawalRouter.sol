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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { RouterBase } from "./RouterBase.sol";
import { IIsolationModeTokenVaultV1 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../protocol/interfaces/IWETH.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { IDepositWithdrawalRouter } from "./interfaces/IDepositWithdrawalRouter.sol";


/**
 * @title   DepositWithdrawalRouter
 * @author  Dolomite
 *
 * @notice  Contract for depositing or withdrawing to/from Dolomite easily
 */
contract DepositWithdrawalRouter is RouterBase, IDepositWithdrawalRouter {
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteStructs.Par;
    using TypesLib for IDolomiteStructs.Wei;
    using DolomiteMarginMath for uint256;
    using InterestIndexLib for IDolomiteMargin;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "DepositWithdrawalRouter";
    bytes32 private constant _WRAPPED_PAYABLE_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.wrappedPayableToken")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PAYABLE_MARKET_ID_SLOT = bytes32(uint256(keccak256("eip1967.proxy.payableMarketId")) - 1);
    bytes32 private constant _IS_INITIALIZED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isInitialized")) - 1);

    // ========================================================
    // ===================== Modifiers ========================
    // ========================================================

    modifier requireInitialized() {
        if (isInitialized()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isInitialized(),
            _FILE,
            "Not initialized"
        );
        _;
    }

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {}

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function ownerLazyInitialize(address _payableToken) external onlyDolomiteMarginOwner(msg.sender) {
        _setAddress(_WRAPPED_PAYABLE_TOKEN_SLOT, _payableToken);
        _setUint256(_PAYABLE_MARKET_ID_SLOT, DOLOMITE_MARGIN().getMarketIdByTokenAddress(_payableToken));
        _setUint256(_IS_INITIALIZED_SLOT, 1);
    }

    receive() external payable {
        if (msg.sender == address(wrappedPayableToken())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender == address(wrappedPayableToken()),
            _FILE,
            "Invalid payable sender"
        );
    }

    // ========================================================
    // ===================== Wei Functions ====================
    // ========================================================

    function depositWei(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        EventFlag _eventFlag
    ) public nonReentrant requireInitialized {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        _amountWei = _amountWei == type(uint256).max ? _getSenderBalance(marketInfo.token) : _amountWei;
        marketInfo.token.safeTransferFrom(msg.sender, address(this), _amountWei);

        _depositWei(
            marketInfo,
            _isolationModeMarketId,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _eventFlag
        );
    }

    function depositPayable(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        EventFlag _eventFlag
    ) external payable nonReentrant requireInitialized {
        _wrap();
        _depositWei(
            _getMarketInfo(payableMarketId()),
            _isolationModeMarketId,
            _toAccountNumber,
            payableMarketId(),
            /* _amountWei = */ msg.value,
            _eventFlag
        );
    }

    function withdrawWei(
        uint256 _isolationModeMarketId,
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant requireInitialized {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        address fromAccount = msg.sender;
        IIsolationModeTokenVaultV1 vault;

        if (_isolationModeMarketId != 0) {
            MarketInfo memory isolationMarketInfo = _getMarketInfo(_isolationModeMarketId);
            vault = _validateIsolationModeMarketAndGetVault(isolationMarketInfo, fromAccount);
            fromAccount = address(vault);

            if (_amountWei == type(uint256).max) {
                IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
                    owner: fromAccount,
                    number: _fromAccountNumber
                });
                _amountWei = DOLOMITE_MARGIN().getAccountWei(accountInfo, _marketId).value;
            }

            if (_isolationModeMarketId == _marketId) {
                marketInfo.factory.enqueueTransferFromDolomiteMargin(fromAccount, _amountWei);
            }
        }

        _withdrawFromDolomiteAndTransferToUser(
            marketInfo.transferToken,
            fromAccount,
            _fromAccountNumber,
            _marketId,
            _amountWei,
            IDolomiteStructs.AssetDenomination.Wei,
            _balanceCheckFlag
        );
        if (_isolationModeMarketId != 0) {
            vault.validateWithdrawalFromVaultAfterTransfer(_fromAccountNumber, _marketId);
        }
    }

    function withdrawPayable(
        uint256 _isolationModeMarketId,
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant requireInitialized {
        address fromAccount = msg.sender;
        IIsolationModeTokenVaultV1 vault;
        if (_isolationModeMarketId != 0) {
            if (_fromAccountNumber != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _fromAccountNumber != 0,
                _FILE,
                "Invalid fromAccountNumber"
            );
            MarketInfo memory isolationMarketInfo = _getMarketInfo(_isolationModeMarketId);
            fromAccount = address(_validateIsolationModeMarketAndGetVault(isolationMarketInfo, fromAccount));
            vault = IIsolationModeTokenVaultV1(fromAccount);
        }

        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            fromAccount,
            _fromAccountNumber,
            address(this),
            payableMarketId(),
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: _amountWei == type(uint256).max
                    ? IDolomiteStructs.AssetReference.Target
                    : IDolomiteStructs.AssetReference.Delta,
                value: _amountWei == type(uint256).max ? 0 : _amountWei
            }),
            _balanceCheckFlag
        );
        _unwrapAndSend();

        if (_isolationModeMarketId != 0) {
            vault.validateWithdrawalFromVaultAfterTransfer(_fromAccountNumber, payableMarketId());
        }
    }

    // ========================================================
    // ===================== Par Functions ====================
    // ========================================================

    function depositPar(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        EventFlag _eventFlag
    ) external nonReentrant requireInitialized {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);

        if (!marketInfo.isIsolationModeAsset && _isolationModeMarketId == 0) {
            // Do an ordinary deposit for the asset
            uint256 weiAmount = _convertParToWei(msg.sender, _toAccountNumber, _marketId, _amountPar);
            marketInfo.token.safeTransferFrom(msg.sender, address(this), weiAmount);
            IERC20(marketInfo.marketToken).safeApprove(address(DOLOMITE_MARGIN()), weiAmount);

            _emitEventIfNecessary(/* _accountOwner = */ msg.sender, _toAccountNumber, _eventFlag);

            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                msg.sender,
                address(this),
                _toAccountNumber,
                _marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: weiAmount
                })
            );
        } else if (!marketInfo.isIsolationModeAsset && _isolationModeMarketId != 0) {
            // Do an ordinary deposit into an isolation mode vault
            MarketInfo memory isoMarketInfo = _getMarketInfo(_isolationModeMarketId);
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(isoMarketInfo, msg.sender);

            _emitEventIfNecessary(/* _accountOwner = */ address(vault), _toAccountNumber, _eventFlag);

            uint256 weiAmount = _convertParToWei(address(vault), _toAccountNumber, _marketId, _amountPar);
            marketInfo.token.safeTransferFrom(msg.sender, address(this), weiAmount);
            IERC20(marketInfo.marketToken).safeApprove(address(DOLOMITE_MARGIN()), weiAmount);

            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                address(vault),
                address(this),
                _toAccountNumber,
                _marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: weiAmount
                })
            );

            vault.validateDepositIntoVaultAfterTransfer(_toAccountNumber, _marketId);
        } else {
            /*assert(marketInfo.isIsolationModeAsset && _isolationModeMarketId == _marketId);*/
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(marketInfo, msg.sender);

            _emitEventIfNecessary(/* _accountOwner = */ address(vault), _toAccountNumber, _eventFlag);

            // Par == Wei for isolation mode tokens
            marketInfo.token.safeTransferFrom(msg.sender, address(this), _amountPar);
            IERC20(marketInfo.marketToken).safeApprove(address(DOLOMITE_MARGIN()), _amountPar);

            marketInfo.factory.enqueueTransferIntoDolomiteMargin(address(vault), _amountPar);
            marketInfo.token.safeApprove(address(vault), _amountPar);

            // Deposits for isolation mode vaults, must first go to the DEFAULT_ACCOUNT_NUMBER
            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                address(vault),
                address(this),
                DEFAULT_ACCOUNT_NUMBER,
                _marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: _amountPar
                })
            );

            if (_toAccountNumber != DEFAULT_ACCOUNT_NUMBER) {
                vault.transferIntoPositionWithUnderlyingToken(DEFAULT_ACCOUNT_NUMBER, _toAccountNumber, _amountPar);
            }
            vault.validateDepositIntoVaultAfterTransfer(_toAccountNumber, _marketId);
        }
    }

    function withdrawPar(
        uint256 _isolationModeMarketId,
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant requireInitialized {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        IIsolationModeTokenVaultV1 vault;
        address fromAccount = msg.sender;

        if (_isolationModeMarketId != 0) {
            MarketInfo memory isolationMarketInfo = _getMarketInfo(_isolationModeMarketId);
            fromAccount = address(_validateIsolationModeMarketAndGetVault(isolationMarketInfo, fromAccount));
            vault = IIsolationModeTokenVaultV1(fromAccount);

            if (_isolationModeMarketId == _marketId) {
                isolationMarketInfo.factory.enqueueTransferFromDolomiteMargin(fromAccount, _amountPar);
                if (_fromAccountNumber == 0) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    _fromAccountNumber == 0,
                    _FILE,
                    "Invalid fromAccountNumber"
                );
            } else {
                if (_fromAccountNumber >= 100) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    _fromAccountNumber >= 100,
                    _FILE,
                    "Invalid fromAccountNumber"
                );
            }
        }

        _withdrawFromDolomiteAndTransferToUser(
            marketInfo.transferToken,
            fromAccount,
            _fromAccountNumber,
            _marketId,
            _amountPar,
            IDolomiteStructs.AssetDenomination.Par,
            _balanceCheckFlag
        );

        if (_isolationModeMarketId != 0) {
            vault.validateWithdrawalFromVaultAfterTransfer(_fromAccountNumber, _marketId);
        }
    }

    function wrappedPayableToken() public view returns (IWETH) {
        return IWETH(_getAddress(_WRAPPED_PAYABLE_TOKEN_SLOT));
    }

    function payableMarketId() public view returns (uint256) {
        return _getUint256(_PAYABLE_MARKET_ID_SLOT);
    }

    function isInitialized() public view returns (bool) {
        return _getUint256(_IS_INITIALIZED_SLOT) == 1;
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _depositWei(
        MarketInfo memory _marketInfo,
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        EventFlag _eventFlag
    ) internal {
        IERC20(_marketInfo.marketToken).safeApprove(address(DOLOMITE_MARGIN()), _amountWei);

        if (!_marketInfo.isIsolationModeAsset && _isolationModeMarketId == 0) {
            _emitEventIfNecessary(/* _accountOwner = */ msg.sender, _toAccountNumber, _eventFlag);

            // Do an ordinary deposit for the asset
            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                msg.sender,
                address(this),
                _toAccountNumber,
                _marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: _amountWei
                })
            );
        } else if (!_marketInfo.isIsolationModeAsset && _isolationModeMarketId != 0) {
            // Do an ordinary deposit into an isolation mode vault
            MarketInfo memory isolationMarketInfo = _getMarketInfo(_isolationModeMarketId);
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(isolationMarketInfo, msg.sender);

            _emitEventIfNecessary(/* _accountOwner = */ address(vault), _toAccountNumber, _eventFlag);

            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                address(vault),
                address(this),
                _toAccountNumber,
                _marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: _amountWei
                })
            );

            vault.validateDepositIntoVaultAfterTransfer(_toAccountNumber, _marketId);
        } else {
            /*assert(_marketInfo.isIsolationModeAsset && _isolationModeMarketId == _marketId);*/
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(_marketInfo, msg.sender);

            _emitEventIfNecessary(/* _accountOwner = */ address(vault), _toAccountNumber, _eventFlag);

            _marketInfo.factory.enqueueTransferIntoDolomiteMargin(address(vault), _amountWei);
            _marketInfo.token.safeApprove(address(vault), _amountWei);

            // Deposits for isolation mode vaults, must first go to the DEFAULT_ACCOUNT_NUMBER
            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                address(vault),
                address(this),
                DEFAULT_ACCOUNT_NUMBER,
                _marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: _amountWei
                })
            );

            if (_toAccountNumber != DEFAULT_ACCOUNT_NUMBER) {
                vault.transferIntoPositionWithUnderlyingToken(DEFAULT_ACCOUNT_NUMBER, _toAccountNumber, _amountWei);
            }

            vault.validateDepositIntoVaultAfterTransfer(_toAccountNumber, _marketId);
        }
    }

    function _withdrawFromDolomiteAndTransferToUser(
        IERC20 _token,
        address _fromAccount,
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amount,
        IDolomiteStructs.AssetDenomination _denomination,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            _fromAccount,
            _fromAccountNumber,
            address(this),
            _marketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: _denomination,
                ref: _amount == type(uint256).max
                        ? IDolomiteStructs.AssetReference.Target
                        : IDolomiteStructs.AssetReference.Delta,
                value: _amount == type(uint256).max ? 0 : _amount
            }),
            _balanceCheckFlag
        );
        _token.safeTransfer(msg.sender, _token.balanceOf(address(this)));
    }

    function _emitEventIfNecessary(
        address _accountOwner,
        uint256 _toAccountNumber,
        EventFlag _eventFlag
    ) internal {
        if (_eventFlag == EventFlag.Borrow) {
            if (_toAccountNumber >= 100) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _toAccountNumber >= 100,
                _FILE,
                "Invalid toAccountNumber"
            );
            DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(_accountOwner, _toAccountNumber);
        }
    }

    function _wrap() internal {
        wrappedPayableToken().deposit{ value: msg.value }();
    }

    function _unwrapAndSend() internal {
        uint256 amount = wrappedPayableToken().balanceOf(address(this));
        wrappedPayableToken().withdraw(amount);
        Address.sendValue(payable(msg.sender), amount);
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function _convertParToWei(
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _amountPar
    ) internal view returns (uint256) {
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
            owner: _accountOwner,
            number: _accountNumber
        });
        IDolomiteStructs.Par memory parBalance = DOLOMITE_MARGIN().getAccountPar(accountInfo, _marketId);
        IDolomiteStructs.Par memory deltaPar = IDolomiteStructs.Par({
            sign: true,
            value: _amountPar.to128()
        });
        parBalance = parBalance.add(deltaPar);

        IDolomiteStructs.Wei memory weiBalanceBefore = DOLOMITE_MARGIN().getAccountWei(accountInfo, _marketId);
        IDolomiteStructs.Wei memory weiBalanceAfter = DOLOMITE_MARGIN().parToWei(_marketId, parBalance);
        return weiBalanceAfter.sub(weiBalanceBefore).value;
    }

    function _getSenderBalance(IERC20 _token) internal view returns (uint) {
        return _token.balanceOf(msg.sender);
    }
}
