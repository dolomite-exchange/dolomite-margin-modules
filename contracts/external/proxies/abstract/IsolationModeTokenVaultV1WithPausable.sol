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
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { TypesLib } from "../../../protocol/lib/TypesLib.sol";
import { IGenericTraderProxyV1 } from "../../interfaces/IGenericTraderProxyV1.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";


/**
 * @title   IsolationModeTokenVaultV1WithPausable
 * @author  Dolomite
 *
 * @notice  An abstract implementation of IsolationModeTokenVaultV1 that disallows borrows if the ecosystem integration
 *          is paused.
 */
abstract contract IsolationModeTokenVaultV1WithPausable is IsolationModeTokenVaultV1 {
    using TypesLib for IDolomiteMargin.Par;
    using TypesLib for IDolomiteMargin.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeVaultV1Pausable"; // shortened to fit in 32 bytes

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireNotPaused() {
        Require.that(
            !isExternalRedemptionPaused(),
            _FILE,
            "Cannot execute when paused"
        );
        _;
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    /**
     * @return  true if redemptions (conversion) from this isolated token to its underlying are paused or are in a
     *          distressed state. Resolving this function to true actives the Pause Sentinel, which prevents further
     *          contamination of this market across Dolomite.
     */
    function isExternalRedemptionPaused() public virtual view returns (bool);

    /// @dev   Cannot further collateralize a position with underlying, when underlying is paused
    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
        internal
        override
        requireNotPaused
    {
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    /// @dev   Cannot reduce collateralization of a position when underlying is paused
    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
        internal
        override
    {
        super._closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
        if (isExternalRedemptionPaused()) {
            _requireNumberOfMarketsWithDebtIsZero(_borrowAccountNumber);
        }
    }

    /// @dev   Cannot further collateralize a position with underlying, when underlying is paused
    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
        internal
        override
        requireNotPaused
    {
        super._transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _borrowAccountNumber, _amountWei);
    }

    /// @dev   Cannot reduce collateralization by withdrawing other tokens, when underlying is paused
    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
        internal
        override
    {
        IDolomiteMargin.Par memory valueBefore = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            }),
            _marketId
        );

        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        );

        IDolomiteMargin.Par memory valueAfter = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            }),
            _marketId
        );

        if (isExternalRedemptionPaused()) {
            if (valueBefore.isPositive()) {
                // If redemptions are paused (preventing liquidations), the user cannot decrease collateralization.
                // If there is no debt markets, the user can can withdraw without affecting collateralization (it's ∞)
                _requireNumberOfMarketsWithDebtIsZero(_borrowAccountNumber);
            } else {
                // If redemptions are paused (preventing liquidations), the borrowed value should not increase
                Require.that(
                    valueAfter.value <= valueBefore.value,
                    _FILE,
                    "Cannot lever up when paused",
                    _marketId
                );
            }
        }
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
        override
    {
        bool isPaused = isExternalRedemptionPaused();
        if (isPaused) {
            uint256 outputMarket = _marketIdsPath[_marketIdsPath.length - 1];
            // If the ecosystem is paused, we cannot swap into more of the irredeemable asset
            Require.that(
                outputMarket != marketId(),
                _FILE,
                "Cannot zap to market when paused",
                outputMarket
            );
        }

        super._swapExactInputForOutput(
            _tradeAccountNumber,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _userConfig
        );

        if (isPaused) {
            uint256 inputMarket = _marketIdsPath[0];
            IDolomiteMargin.Par memory inputValueAfter = DOLOMITE_MARGIN().getAccountPar(
                IDolomiteStructs.AccountInfo({
                    owner: address(this),
                    number: _tradeAccountNumber
                }),
                inputMarket
            );
            Require.that(
                inputValueAfter.isPositive() || inputValueAfter.value == 0,
                _FILE,
                "Cannot lever up when paused",
                inputMarket
            );
        }
    }

    // ===================================================
    // =============== Private Functions =================
    // ===================================================

    function _requireNumberOfMarketsWithDebtIsZero(uint256 _borrowAccountNumber) private view {
        uint256 numberOfMarketsWithDebt = DOLOMITE_MARGIN().getAccountNumberOfMarketsWithDebt(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            })
        );
        // If the user has debt, withdrawing collateral decreases their collateralization
        Require.that(
            numberOfMarketsWithDebt == 0,
            _FILE,
            "Cannot lever up when paused"
        );
    }
}
