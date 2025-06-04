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
    bytes32 private constant _PENDING_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.pendingVault")) - 1);

    // ========================================================
    // ===================== Modifiers ========================
    // ========================================================

    modifier requireInitialized() {
        Require.that(
            isInitialized(),
            _FILE,
            "Not initialized"
        );
        _;
    }

    modifier onlyPendingVault(address _vault) {
        Require.that(
            _getAddress(_PENDING_VAULT_SLOT) == _vault,
            _FILE,
            "Not pending vault"
        );
        _;
        _setAddress(_PENDING_VAULT_SLOT, address(0));
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

    /// @inheritdoc IDepositWithdrawalRouter
    function ownerLazyInitialize(address _payableToken) external onlyDolomiteMarginOwner(msg.sender) {
        _setAddress(_WRAPPED_PAYABLE_TOKEN_SLOT, _payableToken);
        _setUint256(_PAYABLE_MARKET_ID_SLOT, DOLOMITE_MARGIN().getMarketIdByTokenAddress(_payableToken));
        _setUint256(_IS_INITIALIZED_SLOT, 1);
    }

    /**
     * @notice  Receives the payable token from the wrapped token contract. Only the wrapped token contract can send
     *          to this contract.
     */
    receive() external payable {
        Require.that(
            msg.sender == address(wrappedPayableToken()),
            _FILE,
            "Invalid payable sender"
        );
    }

    // ========================================================
    // =================== Deposit Functions ==================
    // ========================================================

    /// @inheritdoc IDepositWithdrawalRouter
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

    /// @inheritdoc IDepositWithdrawalRouter
    function depositPar(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        EventFlag _eventFlag
    ) external nonReentrant requireInitialized {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        uint256 amountWei = _convertParToWei(msg.sender, _toAccountNumber, _marketId, _amountPar);
        marketInfo.token.safeTransferFrom(msg.sender, address(this), amountWei);

        _depositWei(
            marketInfo,
            _isolationModeMarketId,
            _toAccountNumber,
            _marketId,
            amountWei,
            _eventFlag
        );
    }

    /// @inheritdoc IDepositWithdrawalRouter
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

    // ========================================================
    // ================== Withdraw Functions ==================
    // ========================================================

    /// @inheritdoc IDepositWithdrawalRouter
    function withdrawWei(
        uint256 _isolationModeMarketId,
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant requireInitialized {
        if (_isolationModeMarketId != 0) {
            MarketInfo memory isolationMarketInfo = _getMarketInfo(_isolationModeMarketId);
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(isolationMarketInfo, msg.sender);
            _setAddress(_PENDING_VAULT_SLOT, address(vault));

            if (_isolationModeMarketId == _marketId) {
                vault.withdrawFromVaultForDolomiteMarginFromRouter(
                    _fromAccountNumber,
                    _amountWei
                );
            } else {
                vault.withdrawOtherTokenFromVaultFromRouter(
                    _marketId,
                    _fromAccountNumber,
                    _amountWei
                );
            }

            assert(_getAddress(_PENDING_VAULT_SLOT) == address(0));
        } else {
            AccountActionLib.withdraw(
                DOLOMITE_MARGIN(),
                msg.sender,
                _fromAccountNumber,
                msg.sender,
                _marketId,
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
        }
    }

    /// @inheritdoc IDepositWithdrawalRouter
    function withdrawPayable(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant requireInitialized {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            msg.sender,
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
    }

    /// @inheritdoc IDepositWithdrawalRouter
    function withdrawPar(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant requireInitialized {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            msg.sender,
            _fromAccountNumber,
            msg.sender,
            _marketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Par,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountPar
            }),
            _balanceCheckFlag
        );
    }

    // ========================================================
    // ============== Vault Execution Functions ===============
    // ========================================================

    /// @inheritdoc IDepositWithdrawalRouter
    function vaultExecuteDepositIntoDolomiteMargin(
        uint256 _marketId,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external onlyPendingVault(msg.sender) {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        marketInfo.factory.enqueueTransferIntoDolomiteMargin(msg.sender, _amountWei);
        marketInfo.token.safeApprove(msg.sender, _amountWei);

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
    }

    /// @inheritdoc IDepositWithdrawalRouter
    function vaultExecuteDepositOtherTokenIntoDolomiteMargin(
        uint256 _marketId,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external onlyPendingVault(msg.sender) {
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
    }

    /// @inheritdoc IDepositWithdrawalRouter
    function vaultExecuteWithdrawFromDolomiteMargin(
        uint256 _marketId,
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) external onlyPendingVault(msg.sender) {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        if (_amountWei == type(uint256).max) {
            IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
                owner: msg.sender,
                number: _fromAccountNumber
            });
            _amountWei = DOLOMITE_MARGIN().getAccountWei(accountInfo, _marketId).value;
        }

        marketInfo.factory.enqueueTransferFromDolomiteMargin(msg.sender, _amountWei);
        IIsolationModeTokenVaultV1 vault = IIsolationModeTokenVaultV1(msg.sender);

        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            msg.sender,
            _fromAccountNumber,
            address(this),
            _marketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            }),
            AccountBalanceLib.BalanceCheckFlag.From
        );
        marketInfo.transferToken.safeTransfer(vault.OWNER(), _amountWei);
    }

    /// @inheritdoc IDepositWithdrawalRouter
    function vaultExecuteWithdrawOtherTokenFromDolomiteMargin(
        uint256 _marketId,
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) external onlyPendingVault(msg.sender) {
        IIsolationModeTokenVaultV1 vault = IIsolationModeTokenVaultV1(msg.sender);
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            msg.sender,
            _fromAccountNumber,
            vault.OWNER(),
            _marketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            }),
            AccountBalanceLib.BalanceCheckFlag.From // @todo fix balance check flag
        );
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    /// @inheritdoc IDepositWithdrawalRouter
    function wrappedPayableToken() public view returns (IWETH) {
        return IWETH(_getAddress(_WRAPPED_PAYABLE_TOKEN_SLOT));
    }

    /// @inheritdoc IDepositWithdrawalRouter
    function payableMarketId() public view returns (uint256) {
        return _getUint256(_PAYABLE_MARKET_ID_SLOT);
    }

    /// @inheritdoc IDepositWithdrawalRouter
    function isInitialized() public view returns (bool) {
        return _getUint256(_IS_INITIALIZED_SLOT) == 1;
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    /**
     * Deposits wei amount of a token into the sender's account at `_toAccountNumber`. This will
     * automatically deposit into the user's vault if it is an isolation mode token.
     * 
     * @dev Par deposit functions will first convert from par to wei then call this function
     * @dev Function will automatically detect if the user has a vault for the provided _isolationModeMarketId
     * 
     * @param  _marketInfo              The market info for the token being deposited
     * @param  _isolationModeMarketId   The market ID of the isolation mode token vault
     *                                  (0 if not using isolation mode)
     * @param  _toAccountNumber         The account number to deposit into
     * @param  _marketId                The ID of the market being deposited
     * @param  _amountWei               The amount in Wei to deposit. Use type(uint256).max to deposit
     *                                  msg.sender's entire balance
     * @param  _eventFlag               Flag indicating if this deposit should emit special events
     *                                  (e.g. opening a borrow position)
     */
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
            // Do an ordinary deposit for the asset into the user's account
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
            // Deposit a normal token into a user's isolation mode vault
            MarketInfo memory isolationMarketInfo = _getMarketInfo(_isolationModeMarketId);
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(isolationMarketInfo, msg.sender);
            _setAddress(_PENDING_VAULT_SLOT, address(vault));

            vault.depositOtherTokenIntoVaultFromRouter(_marketId, _toAccountNumber, _amountWei);
        } else {
            // Deposit the isolation mode token into the user's isolation mode vault
            assert(_marketInfo.isIsolationModeAsset && _isolationModeMarketId == _marketId);
            IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(_marketInfo, msg.sender);
            _setAddress(_PENDING_VAULT_SLOT, address(vault));

            vault.depositIntoVaultForDolomiteMarginFromRouter(DEFAULT_ACCOUNT_NUMBER, _amountWei);

            if (_toAccountNumber != DEFAULT_ACCOUNT_NUMBER) {
                if (_eventFlag == EventFlag.Borrow) {
                    Require.that(
                        _toAccountNumber >= 100,
                        _FILE,
                        "Invalid toAccountNumber"
                    );
                    DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(address(vault), _toAccountNumber);
                }
                vault.transferIntoPositionWithUnderlyingToken(DEFAULT_ACCOUNT_NUMBER, _toAccountNumber, _amountWei);
            }
        }

        assert(_getAddress(_PENDING_VAULT_SLOT) == address(0));
    }

    /**
     * Wraps the native currency into the wrapped payable token
     */
    function _wrap() internal {
        wrappedPayableToken().deposit{ value: msg.value }();
    }

    /**
     * Unwraps the wrapped payable token into the native currency and sends it to the caller
     */
    function _unwrapAndSend() internal {
        uint256 amount = wrappedPayableToken().balanceOf(address(this));
        wrappedPayableToken().withdraw(amount);
        Address.sendValue(payable(msg.sender), amount);
    }

    /**
     * Converts the par amount to wei
     */
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

    /**
     * Gets the balance of the sender for the token
     */
    function _getSenderBalance(IERC20 _token) internal view returns (uint) {
        return _token.balanceOf(msg.sender);
    }

}
