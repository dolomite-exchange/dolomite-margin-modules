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
import { IIsolationModeTokenVaultV1WithPausable } from "../../interfaces/IIsolationModeTokenVaultV1WithPausable.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";

/**
 * @title   IsolationModeTokenVaultV1WithPausable
 * @author  Dolomite
 *
 * @notice  An abstract implementation of IsolationModeTokenVaultV1 that disallows borrows if the ecosystem integration
 *          is paused.
 */
abstract contract IsolationModeTokenVaultV1WithPausable is
    IIsolationModeTokenVaultV1WithPausable,
    IsolationModeTokenVaultV1
{
    using TypesLib for IDolomiteMargin.Par;
    using TypesLib for IDolomiteMargin.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeVaultV1Pausable"; // shortened to fit in 32 bytes

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier _openBorrowPositionPausableValidator(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) {
        _requireExternalRedemptionNotPaused();
        _;
    }

    modifier _closeBorrowPositionWithOtherTokensPausableValidator(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    ) {
        _;
        if (isExternalRedemptionPaused()) {
            _requireNumberOfMarketsWithDebtIsZero(_borrowAccountNumber);
        }
    }

    modifier _transferIntoPositionWithUnderlyingTokenPausableValidator(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    ) {
        _requireExternalRedemptionNotPaused();
        _;
    }

    modifier _transferFromPositionWithOtherTokenPausableValidator(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) {
        IDolomiteMargin.Par memory valueBefore = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            }),
            _marketId
        );

        _;

        if (isExternalRedemptionPaused()) {
            if (valueBefore.isPositive()) { /* FOR COVERAGE TESTING */ }
            Require.that(valueBefore.isPositive(),
                _FILE,
                "Cannot lever up when paused",
                _marketId
            );

            // If redemptions are paused (preventing liquidations), the user cannot decrease collateralization.
            // If there is no debt markets, the user can can withdraw without affecting collateralization (it's ∞)
            _requireNumberOfMarketsWithDebtIsZero(_borrowAccountNumber);
        }
    }

    modifier _swapExactInputForOutputPausableValidator(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei
    ) {
        bool isPaused = isExternalRedemptionPaused();

        IDolomiteMargin.Wei memory outputBalanceBefore;
        IDolomiteStructs.AccountInfo memory tradeAccount = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _tradeAccountNumber
        });
        if (isPaused) {
            uint256 outputMarket = _marketIdsPath[_marketIdsPath.length - 1];
            // If the ecosystem is paused, we cannot swap into more of the irredeemable asset
            if (outputMarket != marketId()) { /* FOR COVERAGE TESTING */ }
            Require.that(outputMarket != marketId(),
                _FILE,
                "Cannot zap to market when paused",
                outputMarket
            );
            outputBalanceBefore = DOLOMITE_MARGIN().getAccountWei(tradeAccount, outputMarket);
            if (outputBalanceBefore.isNegative()) { /* FOR COVERAGE TESTING */ }
            Require.that(outputBalanceBefore.isNegative(),
                _FILE,
                "Zaps can only repay when paused"
            );
        }

        _;

        if (isPaused) {
            IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
            uint256 inputMarket = _marketIdsPath[0];
            uint256 outputMarket = _marketIdsPath[_marketIdsPath.length - 1];
            // we don't need Wei here, and using Par saves gas costs
            IDolomiteMargin.Par memory inputBalanceAfter = dolomiteMargin.getAccountPar(
                tradeAccount,
                inputMarket
            );
            if (inputBalanceAfter.isPositive() || inputBalanceAfter.value == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(inputBalanceAfter.isPositive() || inputBalanceAfter.value == 0,
                _FILE,
                "Cannot lever up when paused",
                inputMarket
            );

            IDolomiteMargin.Wei memory outputBalanceAfter = dolomiteMargin.getAccountWei(tradeAccount, outputMarket);
            IDolomiteMargin.Wei memory outputDelta = outputBalanceAfter.sub(outputBalanceBefore);

            uint256 inputValue = _inputAmountWei * dolomiteMargin.getMarketPrice(inputMarket).value;
            uint256 outputDeltaValue = outputDelta.value * dolomiteMargin.getMarketPrice(outputMarket).value;
            uint256 slippageNumerator = dolomiteRegistry().slippageToleranceForPauseSentinel();
            uint256 slippageDenominator = dolomiteRegistry().slippageToleranceForPauseSentinelBase();
            // Confirm the user is doing a fair trade and there is not more than the acceptable slippage while paused
            if (outputDeltaValue >= inputValue - (inputValue * slippageNumerator / slippageDenominator)) { /* FOR COVERAGE TESTING */ }
            Require.that(outputDeltaValue >= inputValue - (inputValue * slippageNumerator / slippageDenominator),
                _FILE,
                "Unacceptable trade when paused"
            );
        }
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
        virtual
        override
        _openBorrowPositionPausableValidator(
            _fromAccountNumber,
            _toAccountNumber,
            _amountWei
        )
    {
        super._openBorrowPosition(
            _fromAccountNumber,
            _toAccountNumber,
            _amountWei
        );
    }

    /// @dev   Cannot reduce collateralization of a position when underlying is paused
    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
        internal
        virtual
        override
        _closeBorrowPositionWithOtherTokensPausableValidator(
            _borrowAccountNumber,
            _toAccountNumber,
            _collateralMarketIds
        )
    {
        super._closeBorrowPositionWithOtherTokens(
            _borrowAccountNumber,
            _toAccountNumber,
            _collateralMarketIds
        );
    }

    /// @dev   Cannot further collateralize a position with underlying, when underlying is paused
    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
        internal
        virtual
        override
        _transferIntoPositionWithUnderlyingTokenPausableValidator(
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
        )
    {
        super._transferIntoPositionWithUnderlyingToken(
            _fromAccountNumber,
            _borrowAccountNumber,
            _amountWei
        );
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
        virtual
        override
        _transferFromPositionWithOtherTokenPausableValidator(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
        )
    {
        super._transferFromPositionWithOtherToken(
            _borrowAccountNumber,
            _toAccountNumber,
            _marketId,
            _amountWei,
            _balanceCheckFlag
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
        override
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

    // ===================================================
    // =============== Private Functions =================
    // ===================================================

    function _requireExternalRedemptionNotPaused() private view {
        if (!isExternalRedemptionPaused()) { /* FOR COVERAGE TESTING */ }
        Require.that(!isExternalRedemptionPaused(),
            _FILE,
            "Cannot execute when paused"
        );
    }

    function _requireNumberOfMarketsWithDebtIsZero(uint256 _borrowAccountNumber) private view {
        uint256 numberOfMarketsWithDebt = DOLOMITE_MARGIN().getAccountNumberOfMarketsWithDebt(
            IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: _borrowAccountNumber
            })
        );
        // If the user has debt, withdrawing collateral decreases their collateralization
        if (numberOfMarketsWithDebt == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(numberOfMarketsWithDebt == 0,
            _FILE,
            "Cannot lever up when paused"
        );
    }
}
