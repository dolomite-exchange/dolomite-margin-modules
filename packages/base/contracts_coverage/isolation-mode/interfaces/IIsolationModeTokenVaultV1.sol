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

import { IBorrowPositionProxyV2 } from "../../interfaces/IBorrowPositionProxyV2.sol";
import { IDolomiteRegistry } from "../../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderBase } from "../../interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "../../interfaces/IGenericTraderProxyV1.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";


/**
 * @title   IIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice Interface for the implementation contract used by proxy user vault contracts.
 */
interface IIsolationModeTokenVaultV1 {

    struct SwapExactInputForOutputParams {
        uint256 tradeAccountNumber;
        uint256[] marketIdsPath;
        uint256 inputAmountWei;
        uint256 minOutputAmountWei;
        IGenericTraderProxyV1.TraderParam[] tradersPath;
        IDolomiteStructs.AccountInfo[] makerAccounts;
        IGenericTraderProxyV1.UserConfig userConfig;
    }

    // ===========================================================
    // ======================== Functions ========================
    // ===========================================================

    /**
     * @notice  Initializes the vault contract. Should only be executable once by the proxy.
     */
    function initialize() external;

    /**
     * @notice  End-user function for depositing the vault factory's underlying token into DolomiteMargin. Should only
     *          be executable by the vault owner OR the vault factory.
     */
    function depositIntoVaultForDolomiteMargin(uint256 _toAccountNumber, uint256 _amountWei) external;

    /**
     * @notice  End-user function for withdrawing the vault factory's underlying token from DolomiteMargin. Should only
     *          be executable by the vault owner.
     */
    function withdrawFromVaultForDolomiteMargin(uint256 _fromAccountNumber, uint256 _amountWei) external;

    /**
     * @notice  End-user function for opening a borrow position involving the vault factory's underlying token. Should
     *          only be executable by the vault owner. Reverts if `_fromAccountNumber` is not 0 or if `_toAccountNumber`
     *          is 0.
     */
    function openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external payable;

    /**
     * @notice  End-user function for closing a borrow position involving the vault factory's underlying token. Should
     *          only be executable by the vault owner. Reverts if `_borrowAccountNumber` is 0 or if `_toAccountNumber`
     *          is not 0.
     */
    function closeBorrowPositionWithUnderlyingVaultToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber
    ) external;

    /**
     * @notice  End-user function for closing a borrow position involving anything BUT the vault factory's underlying
     *          token. Should only be executable by the vault owner. Throws if any of the `collateralMarketIds` is set
     *          to the vault factory's underlying token. Reverts if `_borrowAccountNumber` is 0.
     */
    function closeBorrowPositionWithOtherTokens(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata collateralMarketIds
    ) external;

    /**
     * @notice  End-user function for transferring collateral into a position using the vault factory's underlying
     *          token. Should only be executable by the vault owner. Reverts if `_fromAccountNumber` is not 0 or if
     *          `_borrowAccountNumber` is 0.
     */
    function transferIntoPositionWithUnderlyingToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _amountWei
    ) external;

    /**
     * @notice  End-user function for transferring collateral into a position using anything BUT the vault factory's
     *          underlying token. Should only be executable by the vault owner. Throws if the `_marketId` is set to the
     *          vault factory's underlying token. Reverts if `_borrowAccountNumber` is 0.
     */
    function transferIntoPositionWithOtherToken(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @notice  End-user function for transferring collateral from a position using the vault factory's underlying
     *          token. Should only be executable by the vault owner. Reverts if `_borrowAccountNumber` is 0 or if
     *          `_toAccountNumber` is not 0.
     */
    function transferFromPositionWithUnderlyingToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external;

    /**
     * @notice  End-user function for transferring collateral from a position using anything BUT the vault factory's
     *          underlying token. Should only be executable by the vault owner. Throws if the `_marketId` is set to the
     *          vault factory's underlying token. Reverts if `_borrowAccountNumber` is 0.
     */
    function transferFromPositionWithOtherToken(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @notice  End-user function for transferring collateral involving anything BUT the vault factory's underlying
     *          token. Should only be executable by the vault owner. Throws if the `_marketId` is set to the vault
     *          factory's underlying token. Reverts if `_borrowAccountNumber` is 0.
     */
    function repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @dev     End-user function for adding collateral from the vault (in the case where `_marketIdsPath[0]` is the
     *          underlying marketId) or the vault owner (in the case where `_marketIdsPath[0]` is not the underlying
     *          marketId), then trading an exact amount of input for a minimum amount of output. Reverts if
     *          `_borrowAccountNumber` is 0 or if `_fromAccountNumber` is not 0 (and the `_marketIdsPath[0]` is the
     *          underlying). Reverts if the user has a negative balance for `_marketIdsPath[0]`.
     *
     * @param  _fromAccountNumber           The account number to use for the source of the transfer.
     * @param  _borrowAccountNumber         The account number to use for the vault's trade. Cannot be 0.
     * @param  _marketIdsPath               The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param  _inputAmountWei              The input amount (in wei) to use for the initial trade action. Setting this
     *                                      value to `uint(-1)` will use the user's full balance.
     * @param  _minOutputAmountWei          The minimum output amount expected to be received by the user.
     * @param  _tradersPath                 The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1`.
     * @param  _makerAccounts               The accounts that will be used for the maker side of the trades involving
     *                                      `TraderType.InternalLiquidity`.
     * @param  _userConfig                  The user configuration for the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.From` will check that the user's `_borrowAccountNumber`
     *                                      and `_fromAccountNumber` is non-negative after the trade.
     */
    function addCollateralAndSwapExactInputForOutput(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderBase.TraderParam[] calldata _tradersPath,
        IDolomiteStructs.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV1.UserConfig calldata _userConfig
    )
    external payable;

    /**
     * @dev     End-user function for removing collateral from the vault (in the case where `_marketIdsPath[last]` is
     *          the underlying marketId) or the vault owner (in the case where `_marketIdsPath[last]` is not the
     *          underlying marketId). Reverts if `_borrowAccountNumber` is 0 or if `_toAccountNumber` is not 0 (and
     *          the `_marketIdsPath[0]` is the underlying). Reverts if the user has a negative balance before the swap
     *          for `_marketIdsPath[last]`.
     *
     * @param  _toAccountNumber             The account number to receive the collateral transfer after the trade.
     * @param  _borrowAccountNumber         The account number to use for the vault's trade. Cannot be 0.
     * @param  _marketIdsPath               The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param  _inputAmountWei              The input amount (in wei) to use for the initial trade action. Setting this
     *                                      value to `uint(-1)` will use the user's full balance.
     * @param  _minOutputAmountWei          The minimum output amount expected to be received by the user.
     * @param  _tradersPath                 The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1`.
     * @param  _makerAccounts               The accounts that will be used for the maker side of the trades involving
     *                                      `TraderType.InternalLiquidity`.
     * @param  _userConfig                  The user configuration for the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.From` will check that the user's `_tradeAccountNumber`
     *                                      is non-negative after the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.To` has no effect.
     */
    function swapExactInputForOutputAndRemoveCollateral(
        uint256 _toAccountNumber,
        uint256 _borrowAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderBase.TraderParam[] calldata _tradersPath,
        IDolomiteStructs.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV1.UserConfig calldata _userConfig
    )
    external payable;

    /**
     * @dev     End-user function for swapping an exact amount of input for a minimum amount of output. Reverts if
     *          `_tradeAccountNumber` is 0.
     *
     * @param  _tradeAccountNumber          The account number to use for the vault's trade. Cannot be 0.
     * @param  _marketIdsPath               The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param  _inputAmountWei              The input amount (in wei) to use for the initial trade action. Setting this
     *                                      value to `uint(-1)` will use the user's full balance.
     * @param  _minOutputAmountWei          The minimum output amount expected to be received by the user.
     * @param  _tradersPath                 The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1`.
     * @param  _makerAccounts               The accounts that will be used for the maker side of the trades involving
     *                                      `TraderType.InternalLiquidity`.
     * @param  _userConfig                  The user configuration for the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.From` will check that the user's `_tradeAccountNumber`
     *                                      is non-negative after the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.To` has no effect.
     */
    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderBase.TraderParam[] calldata _tradersPath,
        IDolomiteStructs.AccountInfo[] calldata _makerAccounts,
        IGenericTraderProxyV1.UserConfig calldata _userConfig
    )
    external payable;

    // ==================== Does not modify balances ====================

    /**
     * @notice  Attempts to deposit assets into this vault from the vault's owner. Reverts if the caller is not the
     *          Vault Factory.
     *
     * @param  _from    The sender of the tokens into this vault.
     * @param  _amount  The amount of the vault's underlying token to transfer.
     */
    function executeDepositIntoVault(address _from, uint256 _amount) external;

    /**
     * @notice  Attempts to withdraw assets from this vault to the recipient. Reverts if the caller is not the
     *          Vault Factory.
     *
     * @param  _recipient   The address to receive the withdrawal.
     * @param  _amount      The amount of the vault's underlying token to transfer out.
     */
    function executeWithdrawalFromVault(address _recipient, uint256 _amount) external;

    /**
     * @return The amount of `UNDERLYING_TOKEN` that are currently in this vault.
     */
    function underlyingBalanceOf() external view returns (uint256);

    /**
     * @return The registry used to discover important addresses for Dolomite
     */
    function dolomiteRegistry() external view returns (IDolomiteRegistry);

    function marketId() external view returns (uint256);

    function BORROW_POSITION_PROXY() external view returns (IBorrowPositionProxyV2);

    function DOLOMITE_MARGIN() external view returns (IDolomiteMargin);

    function VAULT_FACTORY() external view returns (address);

    function OWNER() external view returns (address);
}
