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
import { IGenericTraderProxyV2 } from '../proxies/interfaces/IGenericTraderProxyV2.sol';
import { IGenericTraderProxyV1 } from '../interfaces/IGenericTraderProxyV1.sol';
import { IGenericTraderBase } from '../interfaces/IGenericTraderBase.sol';
import { IDolomiteMargin } from '../protocol/interfaces/IDolomiteMargin.sol';
import { IIsolationModeTokenVaultV2 } from '../isolation-mode/interfaces/IIsolationModeTokenVaultV2.sol';
import { Require } from '../protocol/lib/Require.sol';
import { AccountBalanceLib } from '../lib/AccountBalanceLib.sol';

/**
 * @title   GenericTraderRouter
 * @author  Dolomite
 *
 * @notice  Router contract for opening borrow positions
 */
contract GenericTraderRouter is RouterBase {

  // ========================================================
  // ====================== Constants =======================
  // ========================================================

  bytes32 private constant _FILE = 'GenericTraderRouter';

  enum TransferType {
    IntoPosition,
    OutOfPosition
  }

  // ========================================================
  // ===================== Constructor ========================
  // ========================================================

  constructor(
    address _dolomiteRegistry,
    address _dolomiteMargin
  ) RouterBase(_dolomiteRegistry, _dolomiteMargin) {
  }

  // ========================================================
  // ================== External Functions ==================
  // ========================================================

  struct SwapExactInputForOutputParams {
    uint256 vaultMarketId;
    uint256 otherAccountNumber;
    uint256 tradeAccountNumber;
    uint256[] marketIdsPath;
    uint256 inputAmountWei;
    uint256 minOutputAmountWei;
    IGenericTraderBase.TraderParam[] tradersPath;
    IDolomiteMargin.AccountInfo[] makerAccounts;
    IGenericTraderProxyV2.UserConfig userConfig;
  }

  function swapExactInputForOutput(
    SwapExactInputForOutputParams memory _params
  ) external nonReentrant {
    if (_params.vaultMarketId == type(uint256).max && _params.otherAccountNumber == type(uint256).max) {
      IGenericTraderProxyV2 proxy = IGenericTraderProxyV2(address(DOLOMITE_REGISTRY.genericTraderProxy()));
      proxy.swapExactInputForOutputForDifferentAccount(
        msg.sender,
        _params.tradeAccountNumber,
        _params.marketIdsPath,
        _params.inputAmountWei,
        _params.minOutputAmountWei,
        _params.tradersPath,
        _params.makerAccounts,
        _params.userConfig
      );
    } else {
      MarketInfo memory marketInfo = _getMarketInfo(_params.vaultMarketId);
      IIsolationModeTokenVaultV2 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

      if (_params.marketIdsPath[_params.marketIdsPath.length - 1] == _params.vaultMarketId && _params.tradeAccountNumber == 0) {
        vault.addCollateralAndSwapExactInputForOutput(
          _params.otherAccountNumber,
          _params.tradeAccountNumber,
          _params.marketIdsPath,
          _params.inputAmountWei,
          _params.minOutputAmountWei,
          _params.tradersPath,
          _params.makerAccounts,
          _params.userConfig
        );
      } else if (_params.marketIdsPath[0] == _params.vaultMarketId && _params.tradeAccountNumber == 0) {
        vault.swapExactInputForOutputAndRemoveCollateral(
          _params.otherAccountNumber,
          _params.tradeAccountNumber,
          _params.marketIdsPath,
          _params.inputAmountWei,
          _params.minOutputAmountWei,
          _params.tradersPath,
          _params.makerAccounts,
          _params.userConfig
        );
      } else {
        vault.swapExactInputForOutput(
          _params.tradeAccountNumber,
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
    uint256 _vaultMarketId,
    IGenericTraderProxyV2.SwapExactInputForOutputAndModifyPositionParams memory _params
  ) external nonReentrant {
    if (_vaultMarketId == type(uint256).max) {
      IGenericTraderProxyV2 proxy = IGenericTraderProxyV2(address(DOLOMITE_REGISTRY.genericTraderProxy()));
      proxy.swapExactInputForOutputAndModifyPositionForDifferentAccount(
        msg.sender,
        _params
      );
    } else {
      MarketInfo memory marketInfo = _getMarketInfo(_vaultMarketId);
      IIsolationModeTokenVaultV2 vault = _validateIsoMarketAndGetVault(marketInfo, msg.sender);

      if (_checkAddCollateralAndSwap(_params)) {
        vault.addCollateralAndSwapExactInputForOutput(
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
        vault.swapExactInputForOutputAndRemoveCollateral(
          _params.transferCollateralParams.toAccountNumber,
          _params.transferCollateralParams.fromAccountNumber,
          _params.marketIdsPath,
          _params.inputAmountWei,
          _params.minOutputAmountWei,
          _params.tradersPath,
          _params.makerAccounts,
          _params.userConfig
        );
      } else {
        if (_params.transferCollateralParams.fromAccountNumber < 100 && _params.transferCollateralParams.toAccountNumber >= 100) {
          _doTransfers(_vaultMarketId, vault, _params.transferCollateralParams, TransferType.IntoPosition);
          vault.swapExactInputForOutput(
            _params.tradeAccountNumber,
            _params.marketIdsPath,
            _params.inputAmountWei,
            _params.minOutputAmountWei,
            _params.tradersPath,
            _params.makerAccounts,
            _params.userConfig
          );
        } else {
          vault.swapExactInputForOutput(
            _params.tradeAccountNumber,
            _params.marketIdsPath,
            _params.inputAmountWei,
            _params.minOutputAmountWei,
            _params.tradersPath,
            _params.makerAccounts,
            _params.userConfig
          );
          _doTransfers(_vaultMarketId, vault, _params.transferCollateralParams, TransferType.OutOfPosition);
        }
      }
    }
  }

  function _doTransfers(
    uint256 _vaultMarketId,
    IIsolationModeTokenVaultV2 _vault,
    IGenericTraderProxyV2.TransferCollateralParam memory _params,
    TransferType _transferType
  ) internal {
    for (uint256 i; i < _params.transferAmounts.length; i++) {
      if (_params.transferAmounts[i].marketId == _vaultMarketId) {
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

  function _checkAddCollateralAndSwap(IGenericTraderProxyV2.SwapExactInputForOutputAndModifyPositionParams memory _params) internal pure returns (bool) {
    return (_params.transferCollateralParams.transferAmounts.length == 1 && _params.transferCollateralParams.fromAccountNumber < 100 && _params.transferCollateralParams.toAccountNumber >= 100);
  }

  function _checkSwapAndRemoveCollateral(IGenericTraderProxyV2.SwapExactInputForOutputAndModifyPositionParams memory _params) internal pure returns (bool) {
    return (_params.transferCollateralParams.transferAmounts.length == 1 && _params.transferCollateralParams.fromAccountNumber >= 100 && _params.transferCollateralParams.toAccountNumber < 100);
  }
}
