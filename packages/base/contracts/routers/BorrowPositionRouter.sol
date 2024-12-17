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
import { IIsolationModeTokenVaultV2 } from '../isolation-mode/interfaces/IIsolationModeTokenVaultV2.sol';
import { AccountBalanceLib } from '../lib/AccountBalanceLib.sol';
import { IBorrowPositionRouter } from './interfaces/IBorrowPositionRouter.sol';


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

  // ========================================================
  // ===================== Constructor ========================
  // ========================================================

  constructor(
    address _dolomiteRegistry,
    address _dolomiteMargin
  ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {}

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
      DOLOMITE_REGISTRY.borrowPositionProxy().openBorrowPositionWithDifferentAccounts(
        msg.sender,
        _fromAccountNumber,
        msg.sender,
        _toAccountNumber,
        _marketId,
        _amount,
        _balanceCheckFlag
      );
    } else {
      IIsolationModeTokenVaultV2 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
      vault.openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amount);
    }
  }

  function closeBorrowPosition(
    uint256 _isolationModeMarketId,
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber,
    uint256[] calldata _collateralMarketIds
  ) external nonReentrant {
    if (_isolationModeMarketId == 0) {
      DOLOMITE_REGISTRY.borrowPositionProxy().closeBorrowPositionWithDifferentAccounts(
        msg.sender,
        _borrowAccountNumber,
        msg.sender,
        _toAccountNumber,
        _collateralMarketIds
      );
    } else {
      MarketInfo memory marketInfo = _getMarketInfo(_isolationModeMarketId);
      IIsolationModeTokenVaultV2 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

      if (_collateralMarketIds.length == 0) {
        vault.closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
      } else {
        vault.closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
      }
    }
  }

  function transferBetweenAccounts(
    uint256 _isolationModeMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    _transferBetweenAccounts(
      _isolationModeMarketId,
      _fromAccountNumber,
      _toAccountNumber,
      _marketId,
      _amount,
      _balanceCheckFlag
    );
  }

  function repayAllForBorrowPosition(
    uint256 _isolationModeMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _marketId,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    if (_isolationModeMarketId == 0) {
      DOLOMITE_REGISTRY.borrowPositionProxy().repayAllForBorrowPositionWithDifferentAccounts(
        msg.sender,
        _fromAccountNumber,
        msg.sender,
        _borrowAccountNumber,
        _marketId,
        _balanceCheckFlag
      );
    } else {
      MarketInfo memory marketInfo = _getMarketInfo(_isolationModeMarketId);
      IIsolationModeTokenVaultV2 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
      vault.repayAllForBorrowPosition(_fromAccountNumber, _borrowAccountNumber, _marketId, _balanceCheckFlag);
    }
  }

  // ========================================================
  // ================== Internal Functions ==================
  // ========================================================

  function _transferBetweenAccounts(
    uint256 _isolationModeMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) internal {
    if (_isolationModeMarketId == 0) {
      DOLOMITE_REGISTRY.borrowPositionProxy().transferBetweenAccountsWithDifferentAccounts(
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

    MarketInfo memory marketInfo = _getMarketInfo(_isolationModeMarketId);
    IIsolationModeTokenVaultV2 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    if (_isolationModeMarketId == _marketId) {
      if (_fromAccountNumber < 100 && _toAccountNumber >= 100) {
        vault.transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _toAccountNumber, _amount);
      } else if (_fromAccountNumber >= 100 && _toAccountNumber < 100) {
        vault.transferFromPositionWithUnderlyingToken(_fromAccountNumber, _toAccountNumber, _amount);
      } else {
        revert('BorrowPositionRouter: Invalid transfer between accounts');
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
      } else if (_fromAccountNumber >= 100 && _toAccountNumber < 100) {
        vault.transferFromPositionWithOtherToken(
          _fromAccountNumber,
          _toAccountNumber,
          _marketId,
          _amount,
          _balanceCheckFlag
        );
      } else {
        revert('BorrowPositionRouter: Invalid transfer between accounts');
      }
    }
  }
}
