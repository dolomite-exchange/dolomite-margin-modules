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
import { AccountActionLib } from '../lib/AccountActionLib.sol';
import { AccountBalanceLib } from '../lib/AccountBalanceLib.sol';
import { IDolomiteMargin } from '../protocol/interfaces/IDolomiteMargin.sol';
import { IDolomiteStructs } from '../protocol/interfaces/IDolomiteStructs.sol';
import { IBorrowPositionRouter } from './interfaces/IBorrowPositionRouter.sol';
import { IIsolationModeTokenVaultV1 } from '../isolation-mode/abstract/IsolationModeTokenVaultV1.sol';

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

  constructor(address _dolomiteRegistry, address _dolomiteMargin) RouterBase(_dolomiteRegistry, _dolomiteMargin) {}

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
    if (marketInfo.isIsolationModeAsset) {
      IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
      vault.openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amount);
    } else {
      DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(msg.sender, _toAccountNumber);
      _transferBetweenAccounts(
        msg.sender,
        _fromAccountNumber,
        msg.sender,
        _toAccountNumber,
        _marketId,
        _amount,
        _balanceCheckFlag
      );
    }
  }

  function closeBorrowPosition(
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber,
    uint256[] calldata _collateralMarketIds
  ) external nonReentrant {
    IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
    accounts[0] = IDolomiteStructs.AccountInfo({owner: msg.sender, number: _borrowAccountNumber});
    accounts[1] = IDolomiteStructs.AccountInfo({owner: msg.sender, number: _toAccountNumber});

    uint256 marketIdsLength = _collateralMarketIds.length;
    IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](marketIdsLength);
    for (uint256 i; i < marketIdsLength; ++i) {
      actions[i] = AccountActionLib.encodeTransferAction(
        /* _fromAccountId = */ 0, // solium-disable-line
        /* _toAccountId = */ 1, // solium-disable-line
        _collateralMarketIds[i],
        IDolomiteStructs.AssetDenomination.Wei,
        type(uint256).max
      );
    }

    DOLOMITE_MARGIN().operate(accounts, actions);
  }

  function closeBorrowPositionWithUnderlyingVaultToken(
    uint256 _vaultMarketId,
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    vault.closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
  }

  function closeBorrowPositionWithOtherTokens(
    uint256 _vaultMarketId,
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber,
    uint256[] calldata _collateralMarketIds
  ) external nonReentrant {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    vault.closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
  }

  function transferBetweenAccounts(
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    _transferBetweenAccounts(
      msg.sender,
      _fromAccountNumber,
      msg.sender,
      _toAccountNumber,
      _marketId,
      _amount,
      _balanceCheckFlag
    );
  }

  function transferIntoPositionWithUnderlyingToken(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _amountWei
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    vault.transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _borrowAccountNumber, _amountWei);
  }

  function transferIntoPositionWithOtherToken(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _marketId,
    uint256 _amountWei,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    vault.transferIntoPositionWithOtherToken(_fromAccountNumber, _borrowAccountNumber, _marketId, _amountWei, _balanceCheckFlag);
  }

  function transferFromPositionWithUnderlyingToken(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _amountWei
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    vault.transferFromPositionWithUnderlyingToken(_fromAccountNumber, _borrowAccountNumber, _amountWei);
  }

  function transferFromPositionWithOtherToken(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _marketId,
    uint256 _amountWei,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    vault.transferFromPositionWithOtherToken(_fromAccountNumber, _borrowAccountNumber, _marketId, _amountWei, _balanceCheckFlag);
  }

  function repayAllForBorrowPosition(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _marketId,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    if (_vaultMarketId != type(uint256).max) {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
      IIsolationModeTokenVaultV1 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
      vault.repayAllForBorrowPosition(_fromAccountNumber, _borrowAccountNumber, _marketId, _balanceCheckFlag);
      return;
    }
    IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();

    IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](1);
    actions[0] = AccountActionLib.encodeTransferAction(
      0,
      1,
      _marketId,
      IDolomiteStructs.AssetDenomination.Wei,
      type(uint256).max
    );
    IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
    accounts[0] = IDolomiteStructs.AccountInfo({owner: msg.sender, number: _borrowAccountNumber});
    accounts[1] = IDolomiteStructs.AccountInfo({owner: msg.sender, number: _fromAccountNumber});
    dolomiteMargin.operate(accounts, actions);

    if (
        _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
        || _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
    ) {
        AccountBalanceLib.verifyBalanceIsNonNegative(
            dolomiteMargin,
            msg.sender,
            _fromAccountNumber,
            _marketId
        );
    }

    if (
        _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
        || _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To
    ) {
        AccountBalanceLib.verifyBalanceIsNonNegative(
            dolomiteMargin,
            msg.sender,
            _borrowAccountNumber,
            _marketId
        );
    }
  }

  // ========================================================
  // ================== Internal Functions ==================
  // ========================================================

  function _transferBetweenAccounts(
    address _fromAccount,
    uint256 _fromAccountNumber,
    address _toAccount,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) internal {
    AccountActionLib.transfer(
      DOLOMITE_MARGIN(),
      _fromAccount,
      _fromAccountNumber,
      _toAccount,
      _toAccountNumber,
      _marketId,
      IDolomiteStructs.AssetDenomination.Wei,
      _amount,
      _balanceCheckFlag
    );
  }
}
