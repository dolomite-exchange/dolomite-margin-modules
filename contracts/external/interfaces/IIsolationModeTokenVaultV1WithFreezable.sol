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
import { IWETH } from "../../protocol/interfaces/IWETH.sol";


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
    event IsDepositSourceWrapperSet(bool _isDepositSourceWrapper);
    event ShouldSkipTransferSet(bool _shouldSkipTransfer);
    event ExecutionFeeSet(uint256 _accountNumber, uint256 _executionFee);
    event VirtualBalanceSet(uint256 _balance);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount
    ) external payable;

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
     *  This should only ever be true in the middle of a call. This value should be unset after it is consumed. If this
     *  is called around a try-catch block, it should be unset in the `catch` block.
     *
     * @param  _isDepositSourceWrapper  True if the vault should should pull the deposit from the corresponding Wrapper
     *                                  contract in the next call to `executeDepositIntoVault`.
     */
    function setIsVaultDepositSourceWrapper(bool _isDepositSourceWrapper) external;

    /**
     *
     * @param  _shouldSkipTransfer   True if the vault should skip the transfer in/out of the vault when
     *                              `executeDepositIntoVault` or `executeWithdrawalFromVault` is called.
     *                              This should only ever be true in the middle of a call. This value should be unset
     *                              after it is consumed. If this is called around a try-catch block, it should be unset
     *                              in the catch block.
     */
    function setShouldVaultSkipTransfer(bool _shouldSkipTransfer) external;

    /**
     *
     * @return  True if the vault should pull the deposit from the corresponding Wrapper contract in the next call to
     *          `executeDepositIntoVault`. This should only ever be true in the middle of a call. Otherwise, this should
     *          always return `false`.
     */
    function isDepositSourceWrapper() external view returns (bool);

    /**
     *
     * @return  True if the vault should skip the transfer in/out of the vault when `executeDepositIntoVault` or
     *          when `executeWithdrawalFromVault` is called. This should only ever be true in the middle of a call.
     *          Otherwise, this should always return `false`.
     */
    function shouldSkipTransfer() external view returns (bool);

    /**
     *
     * @param  _accountNumber   The sub account whose gas/execution fees should be retrieved
     * @return  The execution fee that's saved for the given account number
     */
    function getExecutionFeeForAccountNumber(uint256 _accountNumber) external view returns (uint256);

    /**
     * @return True if the entire vault is frozen, false otherwise.
     */
    function isVaultFrozen() external view returns (bool);

    /**
     *
     * @param  _accountNumber   The account number of the vault to check.
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

    function WETH() external view returns (IWETH);
}
