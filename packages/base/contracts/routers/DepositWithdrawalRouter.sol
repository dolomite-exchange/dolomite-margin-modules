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
    using DolomiteMarginMath for uint256;
    using InterestIndexLib for IDolomiteMargin;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "DepositWithdrawalRouter";
    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;

    // ========================================================
    // ================= Storage Variables ====================
    // ========================================================

    IWETH public immutable WRAPPED_PAYABLE_TOKEN;
    uint256 public immutable PAYABLE_MARKET_ID;

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        address _payableToken,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {
        WRAPPED_PAYABLE_TOKEN = IWETH(_payableToken);
        PAYABLE_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_payableToken);
        WRAPPED_PAYABLE_TOKEN.approve(address(DOLOMITE_MARGIN()), type(uint256).max);
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    receive() external payable {
        Require.that(
            msg.sender == address(WRAPPED_PAYABLE_TOKEN),
            _FILE,
            "Invalid payable sender"
        );
    }

    // ========================================================
    // ===================== Wei Functions ====================
    // ========================================================

    function depositWei(
        uint256 _marketId,
        uint256 _toAccountNumber,
        uint256 _amountWei,
        EventFlag _eventFlag
    )
    public
    nonReentrant {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        uint256 amount = _amountWei == type(uint256).max ? _getSenderBalance(marketInfo.token) : _amountWei;

        _depositIntoDolomiteMargin(
            marketInfo,
            marketInfo.isIsolationModeAsset ? DEFAULT_ACCOUNT_NUMBER : _toAccountNumber,
            amount,
            IDolomiteStructs.AssetDenomination.Wei
        );

        if (marketInfo.isIsolationModeAsset && _toAccountNumber != 0) {
            _transferUnderlyingTokenBetweenAccounts(
                marketInfo.factory.getVaultByAccount(msg.sender),
                _toAccountNumber,
                _marketId,
                amount,
                IDolomiteStructs.AssetDenomination.Wei,
                _eventFlag
            );
        }
    }

    function depositPayable(
        uint256 _toAccountNumber
    )
    external
    payable
    nonReentrant {
        _wrap();
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ address(this), // solium-disable-line indentation
            _toAccountNumber,
            PAYABLE_MARKET_ID,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: msg.value
            })
        );
    }

    function withdrawWei(
        uint256 _marketId,
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);
        address fromAccount = msg.sender;

        if (marketInfo.isIsolationModeAsset) {
            fromAccount = marketInfo.factory.getVaultByAccount(msg.sender);

            if (_amountWei == type(uint256).max) {
                IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
                    owner: fromAccount,
                    number: _fromAccountNumber
                });
                _amountWei = DOLOMITE_MARGIN().getAccountWei(accountInfo, _marketId).value;
            }
            marketInfo.factory.enqueueTransferFromDolomiteMargin(fromAccount, _amountWei);
        }

        _withdrawFromDolomiteAndTransferToUser(
            marketInfo.token,
            fromAccount,
            _fromAccountNumber,
            _marketId,
            _amountWei,
            IDolomiteStructs.AssetDenomination.Wei,
            _balanceCheckFlag
        );
    }

    function withdrawPayable(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            msg.sender,
            _fromAccountNumber,
            address(this),
            PAYABLE_MARKET_ID,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            }),
            _balanceCheckFlag
        );
        _unwrapAndSend();
    }

    // ========================================================
    // ===================== Par Functions ====================
    // ========================================================

    function depositPar(
        uint256 _marketId,
        uint256 _toAccountNumber,
        uint256 _amountPar,
        EventFlag _eventFlag
    )
    external
    nonReentrant {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);

        _depositIntoDolomiteMargin(
            marketInfo,
            marketInfo.isIsolationModeAsset ? DEFAULT_ACCOUNT_NUMBER : _toAccountNumber,
            _amountPar,
            IDolomiteStructs.AssetDenomination.Par
        );

        if (marketInfo.isIsolationModeAsset && _toAccountNumber != 0) {
            _transferUnderlyingTokenBetweenAccounts(
                marketInfo.factory.getVaultByAccount(msg.sender),
                _toAccountNumber,
                _marketId,
                _amountPar,
                IDolomiteStructs.AssetDenomination.Par,
                _eventFlag
            );
        }
    }

    function withdrawPar(
        uint256 _marketId,
        uint256 _fromAccountNumber,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external nonReentrant {
        MarketInfo memory marketInfo = _getMarketInfo(_marketId);

        address fromAccount = msg.sender;
        if (marketInfo.isIsolationModeAsset) {
            fromAccount = marketInfo.factory.getVaultByAccount(msg.sender);
            marketInfo.factory.enqueueTransferFromDolomiteMargin(fromAccount, _amountPar);
        }

        _withdrawFromDolomiteAndTransferToUser(
            marketInfo.token,
            fromAccount,
            _fromAccountNumber,
            _marketId,
            _amountPar,
            IDolomiteStructs.AssetDenomination.Par,
            _balanceCheckFlag
        );
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _depositIntoDolomiteMargin(
        MarketInfo memory _marketInfo,
        uint256 _toAccountNumber,
        uint256 _amount,
        IDolomiteStructs.AssetDenomination _denomination
    ) internal {
        address toAccount = msg.sender;
        uint256 transferAmount = _amount;

        if (_marketInfo.isIsolationModeAsset) {
            assert(_toAccountNumber == 0);
            toAccount = _marketInfo.factory.getVaultByAccount(msg.sender);
            Require.that(
                toAccount != address(0),
                _FILE,
                "No vault found for account"
            );

            _marketInfo.factory.enqueueTransferIntoDolomiteMargin(toAccount, transferAmount);
            _marketInfo.token.safeApprove(toAccount, transferAmount);
        } else {
            if (_denomination == IDolomiteStructs.AssetDenomination.Par) {
                transferAmount = _convertParToWei(_toAccountNumber, _marketInfo.marketId, _amount);
            }
        }

        // @audit Can you double check I handle par and wei correctly?
        _marketInfo.token.safeTransferFrom(msg.sender, address(this), transferAmount);
        IERC20(_marketInfo.marketToken).safeApprove(address(DOLOMITE_MARGIN()), transferAmount);
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            toAccount,
            address(this),
            _toAccountNumber,
            _marketInfo.marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: _denomination,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amount
            })
        );
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

    function _transferUnderlyingTokenBetweenAccounts(
        address _vault,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amount,
        IDolomiteStructs.AssetDenomination _denomination,
        EventFlag _eventFlag
    ) internal {
        if (_eventFlag == EventFlag.Borrow) {
            Require.that(
                _toAccountNumber >= 100,
                _FILE,
                "Invalid toAccountNumber"
            );
            DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(_vault, _toAccountNumber);
        }
        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            _vault,
            DEFAULT_ACCOUNT_NUMBER,
            _vault,
            _toAccountNumber,
            _marketId,
            _denomination,
            _amount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function _wrap() internal {
        WRAPPED_PAYABLE_TOKEN.deposit{ value: msg.value }();
    }

    function _unwrapAndSend() internal {
        IWETH wrappedPayableToken = WRAPPED_PAYABLE_TOKEN;
        uint256 amount = wrappedPayableToken.balanceOf(address(this));
        wrappedPayableToken.withdraw(amount);
        Address.sendValue(payable(msg.sender), amount);
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function _convertParToWei(
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _amountPar
    ) internal view returns (uint256) {
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: _accountNumber
        });
        IDolomiteStructs.Par memory parAmount = DOLOMITE_MARGIN().getAccountPar(accountInfo, _marketId);
        IDolomiteStructs.Par memory deltaPar = IDolomiteStructs.Par({
            sign: true,
            value: _amountPar.to128()
        });
        parAmount = parAmount.add(deltaPar);

        IDolomiteStructs.Wei memory weiBal = DOLOMITE_MARGIN().getAccountWei(accountInfo, _marketId);
        IDolomiteStructs.Wei memory weiBalAfter = DOLOMITE_MARGIN().parToWei(_marketId, parAmount);
        return weiBalAfter.value - weiBal.value;
    }

    function _getSenderBalance(IERC20 _token) internal view returns (uint) {
        return _token.balanceOf(msg.sender);
    }
}
