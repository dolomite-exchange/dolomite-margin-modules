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
 * @title   IDolomiteOwnerV3
 * @author  Dolomite
 *
 * @notice  Interface for the DolomiteOwnerV3 contract
 */
interface IDolomiteOwnerV3 {

    // ========================================================
    // ======================== Structs =======================
    // ========================================================

    struct Transaction {
        address destination;
        bytes data;
        uint256 creationTimestamp;
        bool executed;
        bool verified;
        bool cancelled;
    }

    struct TransactionExternal {
        address destination;
        bytes data;
    }

    struct CallerData {
        /// @notice The address that may perform invocations on `destination`
        address validCaller;
        /// @notice The contract `validCaller` can invoke
        address destination;
        /// @notice The function selectors that `validCaller` can invoke on `destination`
        bytes4 destinationSelector;
    }

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event SecondsTimeLockedChanged(uint32 _secondsTimeLocked);
    event SecondsValidChanged(uint32 _secondsValid);
    event RoleAdded(bytes32 indexed _role);
    event RoleRemoved(bytes32 indexed _role);

    event TransactionSubmitted(uint256 indexed transactionId);
    event TransactionCancelled(uint256 indexed transactionId);
    event TransactionVerified(uint256 indexed transactionId);
    event TransactionExecuted(uint256 indexed transactionId);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetSecondsTimeLocked(uint32 _secondsTimeLocked) external;

    function ownerSetSecondsValid(uint32 _secondsValid) external;

    function ownerAddRole(bytes32 _role) external;

    function ownerRemoveRole(bytes32 _role) external;

    function ownerAddRoleAddresses(bytes32 _role, address[] calldata _addresses) external;

    function ownerRemoveRoleAddresses(bytes32 _role, address[] calldata _addresses) external;

    function ownerAddRoleFunctionSelectors(bytes32 _role, bytes4[] calldata _selectors) external;

    function ownerRemoveRoleFunctionSelectors(bytes32 _role, bytes4[] calldata _selectors) external;

    function ownerAddRoleToAddressFunctionSelectors(
        bytes32 _role,
        address _destination,
        bytes4[] calldata _selectors
    ) external;

    function ownerRemoveRoleToAddressFunctionSelectors(
        bytes32 _role,
        address _destination,
        bytes4[] calldata _selectors
    ) external;

    function ownerCancelTransaction(uint256 _transactionId) external;

    function ownerCancelTransactions(uint256[] calldata _transactionIds) external;

    // ========================================================
    // =================== Transaction Functions ====================
    // ========================================================

    function submitTransaction(address _destination, bytes calldata _data) external returns (uint256);

    function submitTransactions(TransactionExternal[] calldata _transactions) external returns (uint256[] memory);

    function executeTransactions(uint256[] calldata _transactionIds) external returns (bytes[] memory);

    function executeTransaction(uint256 _transactionId) external returns (bytes memory);

    function verifyTransaction(uint256 _transactionId) external;

    function verifyTransactions(uint256[] calldata _transactionIds) external;

    function submitTransactionAndExecute(address _destination, bytes calldata _data) external returns (bytes memory);

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function getRoles() external view returns (bytes32[] memory);

    function getRoleCount() external view returns (uint256);

    function getRolesViaCursor(uint256 _from, uint256 _to) external view returns (bytes32[] memory);

    function getRoleDatas() external view returns (CallerData[] memory);

    function getRoleDatasViaCursor(uint256 _from, uint256 _to) external view returns (CallerData[] memory);

    function isRole(bytes32 _role) external view returns (bool);

    function getTransactionCount(bool _pending, bool _executed) external view returns (uint256);

    function getTransactionIds(
        uint256 _from,
        uint256 _to,
        bool _pending,
        bool _executed
    ) external view returns (uint256[] memory);

    function isTimelockComplete(uint256 _transactionId) external view returns (bool);

    function isTimelockExpired(uint256 _transactionId) external view returns (bool);

    /**
     *  @notice Logic to check if user has permission to submit the transaction:
     *          1. If user has DEFAULT_ADMIN_ROLE, they can submit the transaction
     *          2. If user does not have DEFAULT_ADMIN, loop through the user's roles and for each role:
     *              2a. If the role is no longer valid, transaction is not approved
     *              2b. If the role is valid, check if the transaction is approved for that role
     **/
    function isCallerApprovedToSubmitTransaction(
        address _caller,
        address _destination,
        bytes4 _selector
    ) external view returns (bool);

    function transactionCount() external view returns (uint256);

    function secondsTimeLocked() external view returns (uint32);
}
