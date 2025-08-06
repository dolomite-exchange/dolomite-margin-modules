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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IsolationModeTokenVaultV1 } from "./IsolationModeTokenVaultV1.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGenericTraderProxyV2 } from "../../proxies/interfaces/IGenericTraderProxyV2.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "../interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";


/**
 * @title   IsolationModeTokenVaultV1WithFreezable
 * @author  Dolomite
 *
 * @notice  Abstract implementation of IsolationModeTokenVaultV1 that disallows user actions
 *          if vault is frozen
 */
abstract contract IsolationModeTokenVaultV1WithFreezable is
    IIsolationModeTokenVaultV1WithFreezable,
    IsolationModeTokenVaultV1
{
    using Address for address payable;
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeVaultV1Freezable"; // shortened to fit in 32 bytes
    bytes32 private constant _IS_VAULT_FROZEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.virtualBalance")) - 1);

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireNotFrozen() {
        _requireNotFrozen();
        _;
    }

    modifier _depositIntoVaultForDolomiteMarginFreezableValidator(uint256 _accountNumber) {
        _requireNotFrozen();
        _;
    }

    modifier _withdrawFromVaultForDolomiteMarginFreezableValidator(uint256 _accountNumber) {
        _requireNotFrozen();
        _;
    }

    modifier _openBorrowPositionFreezableValidator() {
        _requireNotFrozen();
        _;
    }

    modifier _closeBorrowPositionWithUnderlyingVaultTokenFreezableValidator(uint256 _borrowAccountNumber) {
        _requireNotFrozen();
        _;
    }

    modifier _closeBorrowPositionWithOtherTokensFreezableValidator(uint256 _borrowAccountNumber) {
        _requireNotFrozen();
        _;
    }

    modifier _transferIntoPositionWithUnderlyingTokenFreezableValidator() {
        _requireNotFrozen();
        _;
    }

    modifier _transferIntoPositionWithOtherTokenFreezableValidator() {
        _requireNotFrozen();
        _;
    }

    modifier _transferFromPositionWithUnderlyingTokenFreezableValidator(uint256 _borrowAccountNumber) {
        _requireNotFrozen();
        _;
    }

    modifier _transferFromPositionWithOtherTokenFreezableValidator(uint256 _borrowAccountNumber) {
        _requireNotFrozen();
        _;
    }

    modifier _repayAllForBorrowPositionFreezableValidator() {
        _requireNotFrozen();
        _;
    }

    modifier _addCollateralAndSwapExactInputForOutputFreezableValidator() {
        _requireNotFrozen();
        _;
    }

    modifier _swapExactInputForOutputAndRemoveCollateralFreezableValidator() {
        _requireNotFrozen();
        _;
    }

    modifier _swapExactInputForOutputFreezableValidator() {
        _requireNotFrozen();
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function isVaultFrozen() public virtual view returns (bool) {
        return _getUint256(_IS_VAULT_FROZEN_SLOT) == 1;
    }

    // ==================================================================
    // ======================== Overrides ===============================
    // ==================================================================

    function _depositIntoVaultForDolomiteMargin(
        address _from,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override
        _depositIntoVaultForDolomiteMarginFreezableValidator(_toAccountNumber)
    {
        super._depositIntoVaultForDolomiteMargin(_from, _toAccountNumber, _amountWei);
    }

    function _withdrawFromVaultForDolomiteMargin(
        address _to,
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override
        _withdrawFromVaultForDolomiteMarginFreezableValidator(_fromAccountNumber)
    {
        super._withdrawFromVaultForDolomiteMargin(_to, _fromAccountNumber, _amountWei);
    }

    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override
        _openBorrowPositionFreezableValidator
    {
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
        internal
        virtual
        override
        _closeBorrowPositionWithUnderlyingVaultTokenFreezableValidator(_borrowAccountNumber)
    {
        super._closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
    }

    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
        internal
        virtual
        override
        _closeBorrowPositionWithOtherTokensFreezableValidator(_borrowAccountNumber)
    {
        super._closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override
        _transferIntoPositionWithUnderlyingTokenFreezableValidator
    {
        super._transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _borrowAccountNumber, _amountWei);
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
        override
        _transferIntoPositionWithOtherTokenFreezableValidator
    {
        super._transferIntoPositionWithOtherToken(
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
        override
        _transferFromPositionWithUnderlyingTokenFreezableValidator(_borrowAccountNumber)
    {
        super._transferFromPositionWithUnderlyingToken(_borrowAccountNumber, _toAccountNumber, _amountWei);
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
        override
        _transferFromPositionWithOtherTokenFreezableValidator(_borrowAccountNumber)
    {
        super._transferFromPositionWithOtherToken(
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
        override
        _repayAllForBorrowPositionFreezableValidator
    {
        super._repayAllForBorrowPosition(_fromAccountNumber, _borrowAccountNumber, _marketId, _balanceCheckFlag);
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
        override
        _addCollateralAndSwapExactInputForOutputFreezableValidator
    {
        super._addCollateralAndSwapExactInputForOutput(
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
        override
        _swapExactInputForOutputAndRemoveCollateralFreezableValidator
    {
        super._swapExactInputForOutputAndRemoveCollateral(
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
        override
        _swapExactInputForOutputFreezableValidator
    {
        super._swapExactInputForOutput(_params);
    }

    // ==================================================================
    // ======================== Internal Functions ======================
    // ==================================================================

    function _setIsVaultFrozen(bool _isVaultFrozen) internal {
        _setUint256(_IS_VAULT_FROZEN_SLOT, _isVaultFrozen ? 1 : 0);
        emit IsVaultFrozenSet(_isVaultFrozen);
    }

    function _requireNotFrozen() internal view {
        if (!isVaultFrozen()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !isVaultFrozen(),
            _FILE,
            "Vault is frozen"
        );
    }
}
