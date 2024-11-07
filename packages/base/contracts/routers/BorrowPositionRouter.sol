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

  // @audit Make sure checks for account numbers are still in place
  function openBorrowPosition(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    address fromAccount = msg.sender;

    if (_vaultMarketId != type(uint256).max) {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
      fromAccount = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    }

    DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(fromAccount, _toAccountNumber);
    _transferBetweenAccounts(
      fromAccount,
      _fromAccountNumber,
      fromAccount,
      _toAccountNumber,
      _marketId,
      _amount,
      _balanceCheckFlag
    );
  }

  function openBorrowPositionForVault(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amountWei,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    address vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

    DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(vault, _toAccountNumber);
    _transferBetweenAccounts(
      msg.sender,
      _fromAccountNumber,
      vault,
      _toAccountNumber,
      _marketId,
      _amountWei,
      _balanceCheckFlag
    );
  }

  function closeBorrowPosition(
    uint256 _vaultMarketId,
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber,
    uint256[] calldata _collateralMarketIds
  ) external nonReentrant {
    address fromAccount = msg.sender;
    if (_vaultMarketId != type(uint256).max) {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
      fromAccount = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    }

    IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
    accounts[0] = IDolomiteStructs.AccountInfo({owner: fromAccount, number: _borrowAccountNumber});
    accounts[1] = IDolomiteStructs.AccountInfo({owner: fromAccount, number: _toAccountNumber});

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

  function closeBorrowPositionForVault(
    uint256 _vaultMarketId,
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber,
    uint256[] calldata _collateralMarketIds
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    address vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

    IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
    accounts[0] = IDolomiteStructs.AccountInfo({owner: vault, number: _borrowAccountNumber});
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

  function transferBetweenAccounts(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    address fromAccount = msg.sender;
    if (_vaultMarketId != type(uint256).max) {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
      fromAccount = _validateIsoMarketAndGetVault(marketInfo, msg.sender);
    }

    // @audit Make sure this fails if trying to transfer isolation assets between accounts
    _transferBetweenAccounts(
      fromAccount,
      _fromAccountNumber,
      fromAccount,
      _toAccountNumber,
      _marketId,
      _amount,
      _balanceCheckFlag
    );
  }

  function transferBetweenAccountsWithVault(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amountWei,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag,
    IBorrowPositionRouter.Direction _direction
  ) external nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    address vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

    if (_direction == IBorrowPositionRouter.Direction.ToVault) {
      _transferBetweenAccounts(
        msg.sender,
        _fromAccountNumber,
        vault,
        _toAccountNumber,
        _marketId,
        _amountWei,
        _balanceCheckFlag
      );
    } else {
      _transferBetweenAccounts(
        vault,
        _fromAccountNumber,
        msg.sender,
        _toAccountNumber,
        _marketId,
        _amountWei,
        _balanceCheckFlag
      );
    }
  }

  function repayAllForBorrowPosition(
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _marketId,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
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

  function repayAllForBorrowPositionForVault(
    uint256 _vaultMarketId,
    uint256 _fromAccountNumber,
    uint256 _borrowAccountNumber,
    uint256 _marketId,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external nonReentrant {
    IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
    MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
    address vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

    IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](1);
    actions[0] = AccountActionLib.encodeTransferAction(
      0,
      1,
      _marketId,
      IDolomiteStructs.AssetDenomination.Wei,
      type(uint256).max
    );
    IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
    accounts[0] = IDolomiteStructs.AccountInfo({owner: vault, number: _borrowAccountNumber});
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
            vault,
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
