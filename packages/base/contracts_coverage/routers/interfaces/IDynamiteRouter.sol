// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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


/**
 * @title   IDynamiteRouter
 * @author  Dolomite
 *
 * @notice  Interface for Dynamite Router that allows one transaction deposit/borrow and repay/withdraw
 */
interface IDynamiteRouter {

    // ================================================
    // ==================== Enums =====================
    // ================================================

    enum EventFlag {
        None,
        Borrow
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event BorrowPositionOpen(address indexed owner, uint256 indexed number);

    // ================================================
    // ================== Functions ===================
    // ================================================

    /**
     * Deposits collateral and borrows debt in one transaction
     *
     * @param  _accountNumber         The account number of the account to deposit/borrow from
     * @param  _collateralMarketId    The market ID of the collateral token
     * @param  _debtMarketId          The market ID of the debt token
     * @param  _collateralAmountWei   The amount of collateral to deposit
     * @param  _debtAmountWei         The amount of debt to borrow
     * @param  _eventFlag             The event flag to emit
     */
    function depositAndBorrowWei(
        uint256 _accountNumber,
        uint256 _collateralMarketId,
        uint256 _debtMarketId,
        uint256 _collateralAmountWei,
        uint256 _debtAmountWei,
        EventFlag _eventFlag
    ) external;

    /**
     * Repays debt and withdraws collateral in one transaction
     *
     * @dev Use type(uint256).max to repay/withdraw all debt/collateral
     *
     * @param  _accountNumber         The account number of the account to repay/withdraw from
     * @param  _repayMarketId         The market ID of the repay token
     * @param  _collateralMarketId    The market ID of the collateral token
     * @param  _repayAmountWei        The amount of debt to repay
     * @param  _withdrawAmountWei     The amount of collateral to withdraw
     */
    function repayAndWithdrawWei(
        uint256 _accountNumber,
        uint256 _repayMarketId,
        uint256 _collateralMarketId,
        uint256 _repayAmountWei,
        uint256 _withdrawAmountWei
    ) external;
}
