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
import { IsolationModeTokenVaultV1WithFreezable } from "./IsolationModeTokenVaultV1WithFreezable.sol";
import { IsolationModeTokenVaultV1WithPausable } from "./IsolationModeTokenVaultV1WithPausable.sol";
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { IGenericTraderProxyV1 } from "../../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeTokenVaultV1WithFreezableAndPausable } from "../../interfaces/IIsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";


/**
 * @title   IsolationModeTokenVaultV1WithFreezableAndPausable
 * @author  Dolomite
 *
 * @notice  Abstract implementation of IsolationModeTokenVaultV1 that disallows user actions
 *          if vault is frozen or borrows if the ecosystem integration is paused
 */
abstract contract IsolationModeTokenVaultV1WithFreezableAndPausable is
    IIsolationModeTokenVaultV1WithFreezableAndPausable,
    IsolationModeTokenVaultV1WithFreezable,
    IsolationModeTokenVaultV1WithPausable
{

    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _depositIntoVaultForDolomiteMarginFreezableValidator(_toAccountNumber)
    {
        IsolationModeTokenVaultV1._depositIntoVaultForDolomiteMargin(
            _toAccountNumber,
            _amountWei
        );
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _withdrawFromVaultForDolomiteMarginFreezableValidator(_fromAccountNumber)
    {
        IsolationModeTokenVaultV1._withdrawFromVaultForDolomiteMargin(
            _fromAccountNumber,
            _amountWei
        );
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1WithPausable)
        _openBorrowPositionFreezableValidator
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
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _closeBorrowPositionWithUnderlyingVaultTokenFreezableValidator(_borrowAccountNumber)
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
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1WithPausable)
        _closeBorrowPositionWithOtherTokensFreezableValidator(_borrowAccountNumber)
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
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1WithPausable)
        _transferIntoPositionWithUnderlyingTokenFreezableValidator
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
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _transferIntoPositionWithOtherTokenFreezableValidator
    {
        IsolationModeTokenVaultV1._transferIntoPositionWithOtherToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );
    }

    function _transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _transferFromPositionWithUnderlyingTokenFreezableValidator(_borrowAccountNumber)
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
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1WithPausable)
        _transferFromPositionWithOtherTokenFreezableValidator(_borrowAccountNumber)
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
            _balanceCheckFlag
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
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _repayAllForBorrowPositionFreezableValidator
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
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _addCollateralAndSwapExactInputForOutputFreezableValidator
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
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1)
        _swapExactInputForOutputAndRemoveCollateralFreezableValidator(_borrowAccountNumber)
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
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteStructs.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
        internal
        virtual
        override (IsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1WithPausable)
        _swapExactInputForOutputFreezableValidator
        _swapExactInputForOutputPausableValidator(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei
        )
    {
        IsolationModeTokenVaultV1._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );
    }
}
