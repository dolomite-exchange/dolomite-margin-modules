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

import { RouterBase } from './RouterBase.sol';
import { IIsolationModeTokenVaultV1 } from '../isolation-mode/abstract/IsolationModeTokenVaultV1.sol';
import { AccountActionLib } from '../lib/AccountActionLib.sol';
import { AccountBalanceLib } from '../lib/AccountBalanceLib.sol';
import { IDolomiteMargin } from '../protocol/interfaces/IDolomiteMargin.sol';
import { IDolomiteStructs } from '../protocol/interfaces/IDolomiteStructs.sol';
import { IBorrowPositionRouter } from './interfaces/IBorrowPositionRouter.sol';
import { IBorrowPositionProxyV2 } from '../interfaces/IBorrowPositionProxyV2.sol';


/**
 * @title   BorrowPositionRouter
 * @author  Dolomite
 *
 * @notice  Router contract for opening borrow positions
 */
contract BorrowPositionRouter is RouterBase, IBorrowPositionRouter {

  // ========================================================
  // ====================== Constants =======================
  // ========================================================

  bytes32 private constant _FILE = 'BorrowPositionRouter';

  bytes32 private constant _BORROW_POSITION_PROXY_SLOT = bytes32(uint256(keccak256('eip1967.proxy.borrowPositionProxy')) - 1);

  // ========================================================
  // ===================== Constructor ========================
  // ========================================================

  constructor(
    address _borrowPositionProxy,
    address _dolomiteRegistry,
    address _dolomiteMargin
  ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {
    _ownerSetBorrowPositionProxy(_borrowPositionProxy);
  }

  // ========================================================
  // ================== External Functions ==================
  // ========================================================

  function openBorrowPosition(
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_marketId);
    if (!marketInfo.isIsolationModeAsset) {
      borrowPositionProxy().openBorrowPositionWithDifferentAccounts(
        msg.sender,
        _fromAccountNumber,
        msg.sender,
        _toAccountNumber,
        _marketId,
        _amount,
        _balanceCheckFlag
      );
    } else {
      IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
      vault.openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amount);
    }
  }

  // @todo add open margin position function

  function closeBorrowPosition(
    uint256 _vaultMarketId,
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber,
    uint256[] calldata _collateralMarketIds
  ) external nonReentrant {
    if (_vaultMarketId == type(uint256).max) {
      borrowPositionProxy().closeBorrowPositionWithDifferentAccounts(
        msg.sender,
        _borrowAccountNumber,
        msg.sender,
        _toAccountNumber,
        _collateralMarketIds
      );
    } else {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
      IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

      if (_collateralMarketIds.length == 0) {
        vault.closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
      } else {
        vault.closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
      }
    }
  }

  function transferBetweenAccounts(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    _transferBetweenAccounts(
      _vaultMarketId,
      _fromAccountNumber,
      _toAccountNumber,
      _marketId,
      _amount,
      _balanceCheckFlag
    );
  }

  function repayAllForBorrowPosition(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _marketId,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    if (_vaultMarketId == type(uint256).max) {
      borrowPositionProxy().repayAllForBorrowPositionWithDifferentAccounts(
        msg.sender,
        _fromAccountNumber,
        msg.sender,
        _borrowAccountNumber,
        _marketId,
        _balanceCheckFlag
      );
    } else {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
      IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
      vault.repayAllForBorrowPosition(_fromAccountNumber, _borrowAccountNumber, _marketId, _balanceCheckFlag);
    }
  }

  function ownerSetBorrowPositionProxy(
    address _borrowPositionProxy
  ) external onlyDolomiteMarginOwner(msg.sender) {
    _ownerSetBorrowPositionProxy(_borrowPositionProxy);
  }

  function borrowPositionProxy() public view returns (IBorrowPositionProxyV2) {
    return IBorrowPositionProxyV2(_getAddress(_BORROW_POSITION_PROXY_SLOT));
  }

  // ========================================================
  // ================== Internal Functions ==================
  // ========================================================

  function _transferBetweenAccounts(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) internal {
    if (_vaultMarketId == type(uint256).max) {
      borrowPositionProxy().transferBetweenAccountsWithDifferentAccounts(
        msg.sender,
        _fromAccountNumber,
        msg.sender,
        _toAccountNumber,
        _marketId,
        _amount,
        _balanceCheckFlag
      );
      return;
    }

    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    if (_vaultMarketId == _marketId) {
      if (_fromAccountNumber < 100 && _toAccountNumber >= 100) {
        vault.transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _toAccountNumber, _amount);
      } else {
        vault.transferFromPositionWithUnderlyingToken(_fromAccountNumber, _toAccountNumber, _amount);
      }
    } else {
      if (_fromAccountNumber < 100 && _toAccountNumber >= 100) {
        vault.transferIntoPositionWithOtherToken(
          _fromAccountNumber,
          _toAccountNumber,
          _marketId,
          _amount,
          _balanceCheckFlag
        );
      } else {
        vault.transferFromPositionWithOtherToken(
          _fromAccountNumber,
          _toAccountNumber,
          _marketId,
          _amount,
          _balanceCheckFlag
        );
      }
    }
  }

  function _ownerSetBorrowPositionProxy(address _borrowPositionProxy) internal {
    _setAddress(_BORROW_POSITION_PROXY_SLOT, _borrowPositionProxy);
    emit BorrowPositionProxySet(_borrowPositionProxy);
  }
}
