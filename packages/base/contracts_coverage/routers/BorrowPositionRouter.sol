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

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { RouterBase } from "./RouterBase.sol";
import { IIsolationModeTokenVaultV1 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IBorrowPositionRouter } from "./interfaces/IBorrowPositionRouter.sol";


/**
 * @title   BorrowPositionRouter
 * @author  Dolomite
 *
 * @notice  Router contract for opening borrow positions
 */
contract BorrowPositionRouter is RouterBase, IBorrowPositionRouter {
  using Address for address;

  // ========================================================
  // ====================== Constants =======================
  // ========================================================

  bytes32 private constant _FILE = "BorrowPositionRouter";

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
    uint256 _isolationModeMarketId,
    uint256 _fromAccountNumber,
    uint256 _toAccountNumber,
    uint256 _marketId,
    uint256 _amount,
    AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
  ) external payable nonReentrant {
    MarketInfo memory marketInfo = _getMarketInfo(_marketId);
    if (!marketInfo.isIsolationModeAsset && _isolationModeMarketId == 0) {
      if (msg.value == 0) { /* FOR COVERAGE TESTING */ }
      Require.that(
          msg.value == 0,
        _FILE,
        "Invalid msg.value"
      );

      DOLOMITE_REGISTRY.borrowPositionProxy().openBorrowPositionWithDifferentAccounts(
        /* _fromAccountOwner = */ msg.sender,
        _fromAccountNumber,
        /* _toAccountOwner = */ msg.sender,
        _toAccountNumber,
        _marketId,
        _amount,
        _balanceCheckFlag
      );
    } else if (!marketInfo.isIsolationModeAsset && _isolationModeMarketId != 0) {
      MarketInfo memory isolationMarketInfo = _getMarketInfo(_isolationModeMarketId);
      IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(isolationMarketInfo, msg.sender);

      DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(address(vault), _toAccountNumber);
      vault.transferIntoPositionWithOtherToken(
        _fromAccountNumber,
        _toAccountNumber,
        _marketId,
        _amount,
        _balanceCheckFlag
      );
    } else {
      /*assert(marketInfo.isIsolationModeAsset && _isolationModeMarketId == _marketId);*/
      IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(marketInfo, msg.sender);
      vault.openBorrowPosition{value: msg.value}(_fromAccountNumber, _toAccountNumber, _amount);
    }
  }

  function closeBorrowPosition(
    uint256 _isolationModeMarketId,
    uint256 _borrowAccountNumber,
    uint256 _toAccountNumber,
    uint256[] calldata _collateralMarketIds
  ) external nonReentrant {
    if (_collateralMarketIds.length != 0) { /* FOR COVERAGE TESTING */ }
    Require.that(
        _collateralMarketIds.length != 0,
      _FILE,
      "Collateral market IDs is empty"
    );

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
      IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(marketInfo, msg.sender);

      bool foundUnderlying = false;
      for (uint256 i; i < _collateralMarketIds.length; ++i) {
        if (_collateralMarketIds[i] == _isolationModeMarketId) {
          foundUnderlying = true;
          break;
        }
      }

      uint256 cursor = 0;
      uint256[] memory collateralMarketIdsWithoutUnderlying = new uint256[](
        _collateralMarketIds.length - (foundUnderlying ? 1 : 0)
      );
      for (uint256 i; i < _collateralMarketIds.length; ++i) {
        if (_collateralMarketIds[i] != _isolationModeMarketId) {
          collateralMarketIdsWithoutUnderlying[cursor++] = _collateralMarketIds[i];
        }
      }

      if (foundUnderlying) {
        vault.closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
      }
      if (collateralMarketIdsWithoutUnderlying.length != 0) {
        vault.closeBorrowPositionWithOtherTokens(
          _borrowAccountNumber,
          _toAccountNumber,
          collateralMarketIdsWithoutUnderlying
        );
      }
    }
  }

  function transferBorrowPosition(
    uint256 _isolationModeMarketId,
    uint256 _borrowAccountNumber,
    address _recipient,
    uint256 _recipientAccountNumber
  ) external nonReentrant {
    if (_recipient != address(0)) { /* FOR COVERAGE TESTING */ }
    Require.that(
        _recipient != address(0),
      _FILE,
      "Invalid recipient"
    );

    if (DOLOMITE_MARGIN().getIsLocalOperator(_recipient, msg.sender)) { /* FOR COVERAGE TESTING */ }
    Require.that(
        DOLOMITE_MARGIN().getIsLocalOperator(_recipient, msg.sender),
      _FILE,
      "Unauthorized transfer"
    );

    IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
    accounts[0] = IDolomiteStructs.AccountInfo({
      owner: msg.sender,
      number: _borrowAccountNumber
    });
    accounts[1] = IDolomiteStructs.AccountInfo({
      owner: _recipient,
      number: _recipientAccountNumber
    });

    if (_isolationModeMarketId != 0) {
      MarketInfo memory marketInfo = _getMarketInfo(_isolationModeMarketId);
      accounts[0].owner = address(_validateIsolationModeMarketAndGetVault(marketInfo, accounts[0].owner));
      accounts[1].owner = address(_validateIsolationModeMarketAndGetVault(marketInfo, accounts[1].owner));
    }

    {
      uint256 marketCount = DOLOMITE_MARGIN().getAccountNumberOfMarketsWithBalances(accounts[1]);
      if (marketCount == 0) { /* FOR COVERAGE TESTING */ }
      Require.that(
          marketCount == 0,
        _FILE,
        "Recipient cannot have markets"
      );
    }

    uint256[] memory marketIds = DOLOMITE_MARGIN().getAccountMarketsWithBalances(accounts[0]);
    IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](marketIds.length);

    for (uint256 i; i < marketIds.length; ++i) {
      actions[i] = AccountActionLib.encodeTransferAction(
        /* _fromAccountId = */ 0,
        /* _toAccountId = */ 1,
        marketIds[i],
        IDolomiteStructs.AssetDenomination.Wei,
        type(uint256).max
      );
    }

    if (_recipientAccountNumber != 0) {
      DOLOMITE_REGISTRY.eventEmitter().emitBorrowPositionOpen(accounts[1].owner, _recipientAccountNumber);
    }
    DOLOMITE_MARGIN().operate(accounts, actions);
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
      IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(marketInfo, msg.sender);
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
    IIsolationModeTokenVaultV1 vault = _validateIsolationModeMarketAndGetVault(marketInfo, msg.sender);
    if (_isolationModeMarketId == _marketId) {
      if (isDolomiteBalance(_fromAccountNumber) && !isDolomiteBalance(_toAccountNumber)) {
        vault.transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _toAccountNumber, _amount);
      } else if (!isDolomiteBalance(_fromAccountNumber) && isDolomiteBalance(_toAccountNumber)) {
        vault.transferFromPositionWithUnderlyingToken(_fromAccountNumber, _toAccountNumber, _amount);
      } else {
        revert("BorrowPositionRouter: Invalid transfer between accounts");
      }
    } else {
      if (isDolomiteBalance(_fromAccountNumber) && !isDolomiteBalance(_toAccountNumber)) {
        vault.transferIntoPositionWithOtherToken(
          _fromAccountNumber,
          _toAccountNumber,
          _marketId,
          _amount,
          _balanceCheckFlag
        );
      } else if (!isDolomiteBalance(_fromAccountNumber) && isDolomiteBalance(_toAccountNumber)) {
        vault.transferFromPositionWithOtherToken(
          _fromAccountNumber,
          _toAccountNumber,
          _marketId,
          _amount,
          _balanceCheckFlag
        );
      } else {
        revert("BorrowPositionRouter: Invalid transfer between accounts");
      }
    }
  }
}
