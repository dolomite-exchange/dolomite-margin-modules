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

import { IIsolationModeVaultFactory } from "./IIsolationModeVaultFactory.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   IFreezableIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  A wrapper contract around a certain token to offer isolation mode features for DolomiteMargin and freezable
 *          vaults.
 */
interface IFreezableIsolationModeVaultFactory is IIsolationModeVaultFactory {

    // ==========================================================
    // ========================= Enums ==========================
    // ==========================================================

    enum FreezeType {
        Deposit,
        Withdrawal
    }

    // ==========================================================
    // ========================= Events =========================
    // ==========================================================

    event VaultAccountFrozen(
        address indexed vault,
        uint256 indexed accountNumber,
        bool isFrozen
    );

    // ===========================================================
    // ======================== Functions ========================
    // ===========================================================

    /**
     *
     * @param  _vault           The address of the vault whose frozen status should change
     * @param  _accountNumber   The account number (sub account) for the corresponding vault
     * @param  _freezeType      The type of freeze that may have a pending callback amount (Deposit or Withdrawal)
     * @param  _amountDeltaWei  The amount that is pending for this sub account. Set to positive to add to the pending
     *                          amount or negative to subtract from it.
     */
    function updateVaultAccountPendingAmountForFrozenStatus(
        address _vault,
        uint256 _accountNumber,
        FreezeType _freezeType,
        IDolomiteStructs.Wei calldata _amountDeltaWei
    ) external;

    /**
     *
     * @param  _vault   The address of the vault that may be frozen
     * @return          True if any sub account for the corresponding `_vault` is frozen, or false if none are.
     */
    function isVaultFrozen(
        address _vault
    ) external view returns (bool);

    /**
     *
     * @param  _vault           The address of the vault that may be frozen
     * @param  _accountNumber   The account number (sub account) for the corresponding vault
     * @return                  True if the corresponding sub account is frozen, or false if it is not.
     */
    function isVaultAccountFrozen(
        address _vault,
        uint256 _accountNumber
    ) external view returns (bool);

    /**
     *
     * @param  _vault           The address of the vault that may have a pending callback amount
     * @param  _accountNumber   The account number (sub account) for the corresponding vault
     * @param  _freezeType      The type of freeze that may have a pending callback amount (Deposit or Withdrawal)
     * @return                  The pending amount for this account. 0 means nothing is pending. FreezeType.ForDeposit
     *                          means the pending amount is positive, and FreezeType.ForWithdrawal means the pending
     *                          amount is negative.
     */
    function getPendingAmountByAccount(
        address _vault,
        uint256 _accountNumber,
        FreezeType _freezeType
    ) external view returns (uint256);
}
