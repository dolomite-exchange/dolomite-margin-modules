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



/**
 * @title   IPartiallyDelayedMultiSig
 * @author  Dolomite
 *
 * @notice  Interface for the delayed owner of Dolomite Margin
 */
interface IPartiallyDelayedMultiSig {

    // ===================================================
    // ===================== Structs =====================
    // ===================================================

    struct Transaction {
        address destination;
        uint256 value;
        bytes data;
        bool executed;
    }

    // ===================================================
    // ====================== Events =====================
    // ===================================================

    event Confirmation(address indexed sender, uint256 indexed transactionId);
    event Revocation(address indexed sender, uint256 indexed transactionId);
    event Submission(uint256 indexed transactionId);
    event Execution(uint256 indexed transactionId);
    event ExecutionFailure(uint256 indexed transactionId, string error);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint256 required);

    event ConfirmationTimeSet(uint256 indexed transactionId, uint256 confirmationTime);
    event TimeLockChange(uint32 secondsTimeLocked);

    event SelectorSet(address destination, bytes4 selector, bool approved);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    /**
     * Changes the duration of the time lock for transactions.
     *
     * @param  _secondsTimeLocked  Duration needed after a transaction is confirmed and before it
     *                             becomes executable, in seconds.
     */
    function changeTimeLock(
        uint32 _secondsTimeLocked
    ) external;

    /**
     * Adds or removes functions that can be executed instantly. Transaction must be sent by wallet.
     *
     * @param  destination  Destination address of function. Zero address allows the function to be
     *                      sent to any address.
     * @param  selector     4-byte selector of the function. Fallback function is 0x00000000.
     * @param  approved     True if adding approval, false if removing approval.
     */
    function setSelector(
        address destination,
        bytes4 selector,
        bool approved
    ) external;

    /**
     * Allows an owner to submit and confirm a transaction.
     *
     * @param  destination  Transaction target address.
     * @param  value        Transaction ether value.
     * @param  data         Transaction data payload.
     * @return              Transaction ID.
     */
    function submitTransaction(
        address destination,
        uint256 value,
        bytes memory data
    ) external returns (uint256);

    /**
     * Allows an owner to execute multiple confirmed transactions.
     *
     * @param  transactionIds  List of transaction IDs.
     */
    function executeMultipleTransactions(
        uint256[] calldata transactionIds
    ) external;

    /**
     * Allows an owner to revoke a confirmation for a transaction.
     *
     * @param  transactionId  Transaction ID.
     */
    function revokeConfirmation(
        uint256 transactionId
    ) external;

    /**
     * Allows a reader to get a particular transaction at the specified index
     *
     * @param  index    The index into the transactions list you want to retrieve
     * @return          The `Transaction` at the specified index
     */
    function transactions(uint256 index) external view returns (address, uint256, bytes memory, bool);

    /**
     * Returns the confirmation status of a transaction.
     *
     * @param  transactionId  Transaction ID.
     * @return                Confirmation status.
     */
    function isConfirmed(
        uint256 transactionId
    ) external view returns (bool);

    /**
     * @return  The number of seconds that the multi sig time-locks transactions
     */
    function secondsTimeLocked() external view returns (uint32);

    /**
     * @return  The owners of this multi sig
     */
    function getOwners() external view returns (address[] memory);
}
