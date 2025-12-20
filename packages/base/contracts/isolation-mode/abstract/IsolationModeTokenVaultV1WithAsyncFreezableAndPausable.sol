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

import { IsolationModeTokenVaultV1 } from "./IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithAsyncFreezable } from "./IsolationModeTokenVaultV1WithAsyncFreezable.sol";
import { IsolationModeTokenVaultV1WithPausable } from "./IsolationModeTokenVaultV1WithPausable.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IGenericTraderProxyV2 } from "../../proxies/interfaces/IGenericTraderProxyV2.sol";
import { IIsolationModeTokenVaultV1WithAsyncFreezableAndPausable } from "../interfaces/IIsolationModeTokenVaultV1WithAsyncFreezableAndPausable.sol"; // solhint-disable-line max-line-length


/**
 * @title   IsolationModeTokenVaultV1WithAsyncFreezableAndPausable
 * @author  Dolomite
 *
 * @notice  Abstract implementation of IsolationModeTokenVaultV1 that disallows user actions
 *          if vault is frozen or borrows if the ecosystem integration is paused
 */
abstract contract IsolationModeTokenVaultV1WithAsyncFreezableAndPausable is
    IIsolationModeTokenVaultV1WithAsyncFreezableAndPausable,
    IsolationModeTokenVaultV1WithAsyncFreezable,
    IsolationModeTokenVaultV1WithPausable
{

    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei,
        bool _isViaRouter
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _depositIntoVaultForDolomiteMarginAsyncFreezableValidator(_toAccountNumber)
        _depositIntoVaultForDolomiteMarginPausableValidator(_toAccountNumber, _amountWei)
    {
        IsolationModeTokenVaultV1._depositIntoVaultForDolomiteMargin(
            _toAccountNumber,
            _amountWei,
            _isViaRouter
        );
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        bool _isViaRouter
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _withdrawFromVaultForDolomiteMarginAsyncFreezableValidator(_fromAccountNumber)
        _withdrawFromVaultForDolomiteMarginPausableValidator(_fromAccountNumber)
    {
        IsolationModeTokenVaultV1._withdrawFromVaultForDolomiteMargin(
            _fromAccountNumber,
            _amountWei,
            _isViaRouter
        );
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _openBorrowPositionAsyncFreezableValidator(_fromAccountNumber, _toAccountNumber)
        _openBorrowPositionPausableValidator(
            _fromAccountNumber,
            _toAccountNumber,
            _amountWei
        )
    {
        IsolationModeTokenVaultV1._openBorrowPosition(
            _fromAccountNumber,
            _toAccountNumber,
            _amountWei
        );
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1)
        _closeBorrowPositionWithUnderlyingVaultTokenAsyncFreezableValidator(_borrowAccountNumber, _toAccountNumber)
    {
        IsolationModeTokenVaultV1._closeBorrowPositionWithUnderlyingVaultToken(
            _borrowAccountNumber,
            _toAccountNumber
        );
    }

    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _closeBorrowPositionWithOtherTokensAsyncFreezableValidator(_borrowAccountNumber)
        _closeBorrowPositionWithOtherTokensPausableValidator(
            _borrowAccountNumber,
            _toAccountNumber,
            _collateralMarketIds
        )
    {
        IsolationModeTokenVaultV1._closeBorrowPositionWithOtherTokens(
            _borrowAccountNumber,
            _toAccountNumber,
            _collateralMarketIds
        );
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _transferIntoPositionWithUnderlyingTokenAsyncFreezableValidator(_fromAccountNumber, _borrowAccountNumber)
        _transferIntoPositionWithUnderlyingTokenPausableValidator(
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
        )
    {
        IsolationModeTokenVaultV1._transferIntoPositionWithUnderlyingToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
        );
    }

    function _transferIntoPositionWithOtherToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag,
        bool _fromWallet
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1)
        _transferIntoPositionWithOtherTokenAsyncFreezableValidator(_borrowAccountNumber)
    {
        IsolationModeTokenVaultV1._transferIntoPositionWithOtherToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag,
            _fromWallet
        );
    }

    function _transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _transferFromPositionWithUnderlyingTokenAsyncFreezableValidator(_borrowAccountNumber, _toAccountNumber)
        _transferFromPositionWithUnderlyingTokenPausableValidator(_borrowAccountNumber, _toAccountNumber, _amountWei)
    {
        IsolationModeTokenVaultV1._transferFromPositionWithUnderlyingToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _amountWei
        );
    }

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag,
        bool _toWallet
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _transferFromPositionWithOtherTokenAsyncFreezableValidator(_borrowAccountNumber)
        _transferFromPositionWithOtherTokenPausableValidator(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        )
    {
        IsolationModeTokenVaultV1._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag,
            _toWallet
        );
    }

    function _repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1)
        _repayAllForBorrowPositionAsyncFreezableValidator(_borrowAccountNumber)
    {
        IsolationModeTokenVaultV1._repayAllForBorrowPosition(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _balanceCheckFlag
        );
    }

    function _addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _addCollateralAndSwapExactInputForOutputAsyncFreezableValidator(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei
        )
    {
        IsolationModeTokenVaultV1._addCollateralAndSwapExactInputForOutput(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _swapExactInputForOutputAndRemoveCollateralAsyncFreezableValidator(
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei
        )
        _swapExactInputForOutputAndRemoveCollateralPausableValidator(
            _borrowAccountNumber
        )
    {
        IsolationModeTokenVaultV1._swapExactInputForOutputAndRemoveCollateral(
            _toAccountNumber,
            _borrowAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithAsyncFreezable, IsolationModeTokenVaultV1WithPausable)
        _swapExactInputForOutputAsyncFreezableValidator(
            _params.tradeAccountNumber,
            _params.marketIdsPath,
            _params.inputAmountWei,
            _params.minOutputAmountWei
        )
        _swapExactInputForOutputPausableValidator(
            _params.tradeAccountNumber,
            _params.marketIdsPath,
            _params.inputAmountWei
        )
    {
        IsolationModeTokenVaultV1._swapExactInputForOutput(_params);
    }
}
