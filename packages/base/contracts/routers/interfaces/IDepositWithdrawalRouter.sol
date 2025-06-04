// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IRouterBase } from "./IRouterBase.sol";
import { AccountBalanceLib } from "../../lib/AccountBalanceLib.sol";
import { IWETH } from "../../protocol/interfaces/IWETH.sol";


/**
 * @title   IDepositWithdrawalRouter
 * @author  Dolomite
 *
 * @notice  Interface for depositing or withdrawing to/from Dolomite easily
 */
interface IDepositWithdrawalRouter is IRouterBase {

    enum EventFlag {
        None,
        Borrow
    }

    /**
     * Initializes the this contract using the payable token
     *
     * @param  _payableToken    The address of the wrapped payable token for this network
     */
    function ownerLazyInitialize(address _payableToken) external;

    // ========================================================
    // =================== Deposit Functions ==================
    // ========================================================

    /**
     * Deposits wei amount of a token into the sender's account at `_toAccountNumber`. This will
     * automatically deposit into the user's vault if it is an isolation mode token.
     *
     * @param  _isolationModeMarketId   The market ID of the isolation mode token vault
     *                                  (0 if not using isolation mode)
     * @param  _toAccountNumber         The account number to deposit into
     * @param  _marketId                The ID of the market being deposited
     * @param  _amountWei               The amount in Wei to deposit. Use type(uint256).max to deposit
     *                                  msg.sender's entire balance
     * @param  _eventFlag               Flag indicating if this deposit should emit
     *                                  special events (e.g. opening a borrow position)
     */
    function depositWei(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        EventFlag _eventFlag
    ) external;

    /**
     * Deposits par amount of a token into the sender's account at `_toAccountNumber`. For isolation
     * mode tokens, this will deposit into the user's vault.
     * 
     * @param  _isolationModeMarketId  The market ID of the isolation mode token, or 0 if not using isolation mode
     * @param  _toAccountNumber        The account number of the account to which the tokens will be deposited
     * @param  _marketId               The market ID of the token to deposit
     * @param  _amountPar              The par amount of tokens to deposit
     * @param  _eventFlag              The flag indicating whether to emit events or not
     */
    function depositPar(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        EventFlag _eventFlag
    ) external;

    /**
     * Deposits native ETH by wrapping it to WETH first
     *
     * @param  _isolationModeMarketId     The market ID of the isolation mode token vault
     *                                    (0 if not using isolation mode)
     * @param  _toAccountNumber           The account number to deposit the wrapped ETH into
     * @param  _eventFlag                 Flag indicating if this deposit should emit special
     *                                    events (e.g. opening a borrow position)
     */
    function depositPayable(
        uint256 _isolationModeMarketId,
        uint256 _toAccountNumber,
        EventFlag _eventFlag
    ) external payable;

    // ========================================================
    // ================== Withdraw Functions ==================
    // ========================================================

    /**
     * Withdraws wei amount of a token from the sender's account at `_fromAccountNumber`. For isolation
     * mode tokens, this will withdraw from the user's vault.
     *
     * @param  _isolationModeMarketId   The market ID of the isolation mode token vault
     *                                  (0 if not using isolation mode)
     * @param  _fromAccountNumber       The account number to withdraw from
     * @param  _marketId                The ID of the market being withdrawn
     * @param  _amountWei               The amount in Wei to withdraw. Use type(uint256).max
     *                                  to withdraw entire balance
     * @param  _balanceCheckFlag        Flag indicating how to validate account balances after
     *                                  withdrawal
     */
    function withdrawWei(
        uint256 _isolationModeMarketId,
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * Withdraws WETH and unwraps it to native ETH
     *
     * @param  _fromAccountNumber       The account number to withdraw from
     * @param  _amountWei               The amount of WETH in Wei to withdraw and unwrap
     * @param  _balanceCheckFlag        Flag indicating how to validate account balances after
     *                                  withdrawal
     */
    function withdrawPayable(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * Withdraws par amount of a token from the sender's account at `_fromAccountNumber`. For isolation
     * mode tokens, this will withdraw from the user's vault
     *
     * @param  _fromAccountNumber       The account number to withdraw from
     * @param  _marketId                The ID of the market being withdrawn
     * @param  _amountPar               The amount in Par units to withdraw
     * @param  _balanceCheckFlag        Flag indicating how to validate account balances after
     *                                  withdrawal
     */
    function withdrawPar(
        uint256 _fromAccountNumber,
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    // ========================================================
    // =============== Vault Execution Functions ==============
    // ========================================================

    /**
     * Executes a deposit for the underlying token into a vault
     * 
     * @dev Only callable by the vault itself
     *
     * @param  _marketId            The market ID of the token to deposit
     * @param  _toAccountNumber     The account number to deposit into
     * @param  _amountWei           The amount in Wei to deposit
     */
    function vaultExecuteDepositIntoDolomiteMargin(
        uint256 _marketId,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external;

    /**
     * Executes a deposit for a non-underlying token into a vault
     * 
     * @dev Only callable by the vault itself
     *
     * @param  _marketId            The market ID of the token to deposit
     * @param  _toAccountNumber     The account number to deposit into
     * @param  _amountWei           The amount in Wei to deposit
     */
    function vaultExecuteDepositOtherTokenIntoDolomiteMargin(
        uint256 _marketId,
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external;

    /**
     * Executes a withdrawal for the underlying token from a vault
     * 
     * @dev Only callable by the vault itself
     *
     * @param  _marketId            The market ID of the token to withdraw
     * @param  _fromAccountNumber   The account number to withdraw from
     * @param  _amountWei           The amount in Wei to withdraw
     */
    function vaultExecuteWithdrawFromDolomiteMargin(
        uint256 _marketId,
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) external;

    /**
     * Executes a withdrawal for a non-underlying token from a vault
     * 
     * @dev Only callable by the vault itself
     *
     * @param  _marketId            The market ID of the token to withdraw
     * @param  _fromAccountNumber   The account number to withdraw from
     * @param  _amountWei           The amount in Wei to withdraw
     */
    function vaultExecuteWithdrawOtherTokenFromDolomiteMargin(
        uint256 _marketId,
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) external;

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    /**
     * Returns the wrapped payable token contract used for payable deposits/withdrawals
     *
     * @return  The IWETH contract address
     */
    function wrappedPayableToken() external view returns (IWETH);

    /**
     * Returns the market ID for the wrapped payable token
     *
     * @return  The market ID of the wrapped payable token
     */
    function payableMarketId() external view returns (uint256);

    /**
     * Returns whether the router has been initialized with a payable token
     *
     * @return  True if initialized, false otherwise
     */
    function isInitialized() external view returns (bool);
}
