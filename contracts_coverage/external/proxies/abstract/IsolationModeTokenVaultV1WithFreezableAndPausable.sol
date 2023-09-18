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
import { ProxyContractHelpers } from "../../helpers/ProxyContractHelpers.sol";
import { IGenericTraderProxyV1 } from "../../interfaces/IGenericTraderProxyV1.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";


/**
 * @title   IsolationModeTokenVaultV1WithFreezableAndPausable
 * @author  Dolomite
 *
 * @notice  Abstract implementation of IsolationModeTokenVaultV1 that disallows user actions
 *          if vault is frozen and borrows if the ecosystem integration is paused
 */
abstract contract IsolationModeTokenVaultV1WithFreezableAndPausable is IsolationModeTokenVaultV1, ProxyContractHelpers {
    using TypesLib for IDolomiteMargin.Par;
    using TypesLib for IDolomiteMargin.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeVaultV1Freeze&Pause"; // shortened to fit in 32 bytes
    bytes32 private constant _IS_VAULT_FROZEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isVaultFrozen")) - 1);

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier requireNotFrozen() {
        if (!isVaultFrozen()) { /* FOR COVERAGE TESTING */ }
        Require.that(!isVaultFrozen(),
            _FILE,
            "Vault is frozen"
        );
        _;
    }

    modifier requireNotPaused() {
        if (!isExternalRedemptionPaused()) { /* FOR COVERAGE TESTING */ }
        Require.that(!isExternalRedemptionPaused(),
            _FILE,
            "Cannot execute when paused"
        );
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function setIsVaultFrozen(
        bool _isVaultFrozen
    )
    external
    onlyVaultFactory(msg.sender) {
        _setIsVaultFrozen(_isVaultFrozen);
    }

    /**
     * @return  true if redemptions (conversion) from this isolated token to its underlying are paused or are in a
     *          distressed state. Resolving this function to true actives the Pause Sentinel, which prevents further
     *          contamination of this market across Dolomite.
     */
    function isExternalRedemptionPaused() public virtual view returns (bool);

    function isVaultFrozen() public view returns (bool) {
        return _getUint256(_IS_VAULT_FROZEN_SLOT) == 1;
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _setIsVaultFrozen(bool _isVaultFrozen) internal {
        _setUint256(_IS_VAULT_FROZEN_SLOT, _isVaultFrozen ? 1 : 0);
    }

    // ==================================================================
    // ======================== Overrides ===============================
    // ==================================================================

    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override
    requireNotFrozen {
        super._depositIntoVaultForDolomiteMargin(_toAccountNumber, _amountWei);
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    internal
    override
    requireNotFrozen {
        super._withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei);
    }

    /// @dev   Cannot further collateralize a position with underlying, when underlying is paused
    function _openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    internal
    override
    requireNotFrozen
    requireNotPaused {
        super._openBorrowPosition(_fromAccountNumber, _toAccountNumber, _amountWei);
    }

    function _closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    )
    internal
    override
    requireNotFrozen {
        super._closeBorrowPositionWithUnderlyingVaultToken(_borrowAccountNumber, _toAccountNumber);
    }

    /// @dev   Cannot reduce collateralization of a position when underlying is paused
    function _closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    )
    internal
    override
    requireNotFrozen {
        super._closeBorrowPositionWithOtherTokens(_borrowAccountNumber, _toAccountNumber, _collateralMarketIds);
        if (isExternalRedemptionPaused()) {
            _requireNumberOfMarketsWithDebtIsZero(_borrowAccountNumber);
        }
    }

    function _transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    )
    internal
    override
    requireNotFrozen
    requireNotPaused {
        super._transferIntoPositionWithUnderlyingToken(_fromAccountNumber, _borrowAccountNumber, _amountWei);
    }

    function _transferIntoPositionWithOtherToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal
    override
    requireNotFrozen {
        super._transferIntoPositionWithOtherToken(
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
    override
    requireNotFrozen {
        super._transferFromPositionWithUnderlyingToken(_borrowAccountNumber, _toAccountNumber, _amountWei);
    }

    function _transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal
    override
    requireNotFrozen {
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

    function _repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    internal
    override
    requireNotFrozen {
        super._repayAllForBorrowPosition(_fromAccountNumber, _borrowAccountNumber, _marketId, _balanceCheckFlag);
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
    override
    requireNotFrozen {
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
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal
    override
    requireNotFrozen {
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
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV1.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV1.UserConfig memory _userConfig
    )
    internal
    virtual
    requireNotFrozen
    override {
        bool isPaused = isExternalRedemptionPaused();

        IDolomiteStructs.AccountInfo memory tradeAccount = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _tradeAccountNumber
        });
        IDolomiteMargin.Wei memory outputBalanceBefore;
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
        if (numberOfMarketsWithDebt == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(numberOfMarketsWithDebt == 0,
            _FILE,
            "Cannot lever up when paused"
        );
    }
}
