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

import { IIsolationModeTokenVaultV1 } from "./IIsolationModeTokenVaultV1.sol";


/**
 * @title   IIsolationModeTokenVaultV1WithFreezable
 * @author  Dolomite
 *
 * @notice Interface for the implementation contract used by proxy user vault contracts.
 */
interface IIsolationModeTokenVaultV1WithFreezable is IIsolationModeTokenVaultV1 {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event IsVaultFrozenSet(bool _isVaultFrozen);

    // ===========================================================
    // ======================== Functions ========================
    // ===========================================================

    /**
     * @dev Throws if the VaultAccount is frozen, if the inputAmount is now the user's whole balance, or if the
     *      outputToken is invalid.
     */
    function initiateUnwrappingForLiquidation(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    ) external payable;

    /**
     * @return True if the entire vault is frozen, false otherwise.
     */
    function isVaultFrozen() external view returns (bool);

    /**
     *
     * @param _accountNumber    The account number of the vault to check.
     * @return True if the vault account is frozen, false otherwise.
     */
    function isVaultAccountFrozen(uint256 _accountNumber) external view returns (bool);

    /**
     * @return The balance of the assets in this vault assuming no pending withdrawals (but includes pending deposits).
     */
    function virtualBalance() external view returns (uint256);

    /**
     * @return  Same as `virtualBalance` but subtracts withdrawals to give a more accurate representation of optimistic
     *          balance assuming all pending changes are executed.
     */
    function virtualBalanceWithoutPendingWithdrawals() external view returns (uint256);
}
