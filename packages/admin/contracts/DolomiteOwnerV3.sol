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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteOwnerV3 } from "./interfaces/IDolomiteOwnerV3.sol";
import { IDolomiteOwnerV3Caller } from "./interfaces/IDolomiteOwnerV3Caller.sol";


/**
 * @title   DolomiteOwnerV3
 * @author  Dolomite
 *
 * @notice  DolomiteOwnerV3 contract that enables an admin to set roles and permissions for other addresses
 */
contract DolomiteOwnerV3 is IDolomiteOwnerV3 {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Address for address;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "DolomiteOwnerV3";

    bytes32 public constant BYPASS_TIMELOCK_ROLE = keccak256("BYPASS_TIMELOCK_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0x0);
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    address private constant _ADDRESS_ZERO = address(0x0);

    // ================================================
    // =================== State Variables ============
    // ================================================

    mapping(bytes32 => EnumerableSet.AddressSet) private _allRoles;
    EnumerableSet.Bytes32Set private _allCallers;
    mapping(bytes32 => CallerData) private _callerData;

    uint32 public secondsTimeLocked;
    uint32 public secondsValid;
    uint192 public transactionCount;
    mapping (uint256 => Transaction) public transactions;

    // ================================================
    // =================== Modifiers ================
    // ================================================

    modifier onlySelf(address _sender) {
        Require.that(
            _sender == address(this),
            _FILE,
            "Invalid caller",
            _sender
        );
        _;
    }

    modifier onlyRole(bytes32 _role, address _sender) {
        Require.that(
            _allRoles[_role].contains(_sender),
            _FILE,
            "Unauthorized",
            _role
        );
        _;
    }

    modifier notNull(address _address) {
        Require.that(
            _address != _ADDRESS_ZERO,
            _FILE,
            "Address is null"
        );
        _;
    }

    modifier transactionExists(uint256 _transactionId) {
        Require.that(
            transactions[_transactionId].destination != _ADDRESS_ZERO,
            _FILE,
            "Transaction does not exist"
        );
        _;
    }

    modifier validVerifier(address _sender) {
        Require.that(
            hasRole(VERIFIER_ROLE, _sender) || hasRole(DEFAULT_ADMIN_ROLE, _sender),
            _FILE,
            "Invalid verifier"
        );
        _;
    }

    modifier validExecutor(address _sender) {
        Require.that(
            hasRole(EXECUTOR_ROLE, _sender) || hasRole(DEFAULT_ADMIN_ROLE, _sender),
            _FILE,
            "Invalid executor"
        );
        _;
    }

    modifier activeRole(bytes32 _role) {
        Require.that(
            isRole(_role),
            _FILE,
            "Invalid role",
            _role
        );
        _;
    }

    modifier pastTimeLock(
        address _sender,
        uint256 _transactionId
    ) {
        Require.that(
            isTimelockComplete(_transactionId) || hasRole(BYPASS_TIMELOCK_ROLE, _sender),
            _FILE,
            "Timelock incomplete"
        );
        _;
    }

    modifier notExpired(
        uint256 _transactionId
    ) {
        Require.that(
            !isTimelockExpired(_transactionId),
            _FILE,
            "Transaction expired"
        );
        _;
    }

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(
        address _admin,
        uint32 _secondsTimeLocked,
        uint32 _secondsValid
    ) {
        _allRoles[DEFAULT_ADMIN_ROLE].add(_admin);

        _ownerSetSecondsTimeLocked(_secondsTimeLocked);
        _ownerSetSecondsValid(_secondsValid);
    }

    // ================================================
    // =================== Admin Functions ============
    // ================================================

    function ownerSetSecondsTimeLocked(
        uint32 _secondsTimeLocked
    ) external onlySelf(msg.sender) {
        _ownerSetSecondsTimeLocked(_secondsTimeLocked);
    }

    function ownerSetSecondsValid(
        uint32 _secondsValid
    ) external onlySelf(msg.sender) {
        _ownerSetSecondsValid(_secondsValid);
    }

    function ownerRegisterRolesFromValidCaller(
        address _validCaller
    ) external onlySelf(msg.sender) {
        (
            bytes32[] memory roles,
            IDolomiteOwnerV3Caller.CallerRegistration[] memory registrations
        ) = computeRolesFromValidCaller(_validCaller);

        for (uint256 i; i < roles.length; i++) {
            Require.that(
                _allCallers.add(roles[i]),
                _FILE,
                "Role already added"
            );
            _callerData[roles[i]] = CallerData({
                validCaller: _validCaller,
                destination: registrations[i].destination,
                destinationSelector: registrations[i].destinationSelector
            });
            emit RoleAdded(roles[i]);
        }
    }

    function ownerUnregisterRolesFromValidCaller(
        bytes32 _role
    ) external onlySelf(msg.sender) {
        Require.that(
            _role != DEFAULT_ADMIN_ROLE,
            _FILE,
            "Cannot remove admin role"
        );

        Require.that(
            _allCallers.remove(_role),
            _FILE,
            "Role not found"
        );
        emit RoleRemoved(_role);
    }

    function ownerCancelTransaction(
        uint256 _transactionId
    ) external onlyRole(DEFAULT_ADMIN_ROLE, /* _sender = */ msg.sender) {
        _ownerCancelTransaction(_transactionId);
    }

    function ownerCancelTransactions(
        uint256[] calldata _transactionIds
    ) external onlyRole(DEFAULT_ADMIN_ROLE, /* _sender = */ msg.sender) {
        for (uint256 i; i < _transactionIds.length; i++) {
            _ownerCancelTransaction(_transactionIds[i]);
        }
    }

    // ================================================
    // ============= Transaction Functions ============
    // ================================================

    function submitTransactionAndExecute(
        address _destination,
        bytes memory _data
    ) external returns (bytes memory) {
        uint256 transactionId = submitTransaction(_destination, _data);
        return executeTransaction(transactionId);
    }

    function executeTransactions(
        uint256[] memory transactionIds
    ) external validExecutor(msg.sender) returns (bytes[] memory) {
        bytes[] memory returnDatas = new bytes[](transactionIds.length);
        for (uint256 i; i < transactionIds.length; i++) {
            returnDatas[i] = _executeTransaction(transactionIds[i]);
        }

        return returnDatas;
    }

    function submitTransactions(
        TransactionExternal[] calldata _transactions
    ) public returns (uint256[] memory) {
        uint256[] memory transactionIds = new uint256[](_transactions.length);
        for (uint256 i; i < _transactions.length; i++) {
            transactionIds[i] = submitTransaction(_transactions[i].destination, _transactions[i].data);
        }

        return transactionIds;
    }

    function submitTransaction(
        address _destination,
        bytes memory _data
    ) public returns (uint256) {
        Require.that(
            _data.length >= 4,
            _FILE,
            "Invalid calldata length"
        );

        bytes32 rawData;
        /* solium-disable-next-line security/no-inline-assembly */
        assembly {
            rawData := mload(add(_data, 32))
        }
        bytes4 selector = bytes4(rawData);

        bool approved = isUserApprovedToSubmitTransaction(msg.sender, _destination, selector);
        Require.that(
            approved,
            _FILE,
            "Transaction not approved"
        );
        return _addTransaction(_destination, _data);
    }

    function verifyTransaction(uint256 _transactionId) external validVerifier(msg.sender) {
        _verifyTransaction(_transactionId);
    }

    function verifyTransactions(uint256[] calldata _transactionIds) external validVerifier(msg.sender) {
        for (uint256 i; i < _transactionIds.length; i++) {
            _verifyTransaction(_transactionIds[i]);
        }
    }

    function executeTransaction(
        uint256 _transactionId
    ) public validExecutor(msg.sender) returns (bytes memory){
        return _executeTransaction(_transactionId);
    }

    // ================================================
    // =============== View Functions =================
    // ================================================

    function getAllAdmins() public view returns (address[] memory) {
        return _allRoles[DEFAULT_ADMIN_ROLE].values();
    }

    function getAllBypassTimelockUsers() public view returns (address[] memory) {
        return _allRoles[BYPASS_TIMELOCK_ROLE].values();
    }

    function getAllExecutors() public view returns (address[] memory) {
        return _allRoles[EXECUTOR_ROLE].values();
    }

    function getAllVerifiers() public view returns (address[] memory) {
        return _allRoles[VERIFIER_ROLE].values();
    }

    function computeRolesFromValidCaller(
        address _validCaller
    ) public view returns (bytes32[] memory, IDolomiteOwnerV3Caller.CallerRegistration[] memory) {
        IDolomiteOwnerV3Caller.CallerRegistration[] memory registrations =
                                IDolomiteOwnerV3Caller(_validCaller).getAdminRoleRegistrationData();
        bytes32[] memory roles = new bytes32[](registrations.length);
        for (uint256 i; i < registrations.length; i++) {
            roles[i] = _computeCallerRole(
                _validCaller,
                registrations[i].destination,
                registrations[i].destinationSelector
            );
        }

        return (roles, registrations);
    }

    function getTransactionCount(
        bool _pending,
        bool _executed
    ) external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i; i < transactionCount; ++i) {
            if (
                (_pending && !transactions[i].executed && !transactions[i].cancelled)
                || (_executed && transactions[i].executed)
            ) {
                count += 1;
            }
        }
        return count;
    }

    function getTransactionIds(
        uint256 _from,
        uint256 _to,
        bool _pending,
        bool _executed
    ) external view returns (uint256[] memory) {
        if (_to > transactionCount) {
            _to = transactionCount;
        }
        uint256[] memory transactionIdsTemp = new uint256[](_to - _from);
        uint256 count = 0;
        uint256 i;
        for (i = _from; i < _to; ++i) {
            if (
                (_pending && !transactions[i].executed && !transactions[i].cancelled)
                || (_executed && transactions[i].executed)
            ) {
                transactionIdsTemp[count] = i;
                count += 1;
            }
        }
        uint256[] memory _transactionIds = new uint256[](count);
        for (i = 0; i < count; ++i) {
            _transactionIds[i] = transactionIdsTemp[i];
        }
        return _transactionIds;
    }

    function isUserApprovedToSubmitTransaction(
        address _user,
        address _destination,
        bytes4 _selector
    ) public view returns (bool) {
        /*
            Logic to check if user has permission to submit the transaction
            1. If user has DEFAULT_ADMIN_ROLE, they can submit the transaction
            2. If user does not have DEFAULT_ADMIN, loop through the user's roles and for each role:
                2a. If the role is no longer valid, transaction is not approved
                2b. If the role is valid, check if the transaction is approved for that role
        */

        if (hasRole(DEFAULT_ADMIN_ROLE, _user)) {
            return true;
        }
        Require.that(
            _destination != address(this),
            _FILE,
            "Invalid destination"
        );

        bytes32 role = _computeCallerRole(_user, _destination, _selector);
        return _isApprovedToSubmitTransaction(role, _destination, _selector);
    }

    function hasRole(bytes32 _role, address _account) public view returns (bool) {
        return _allRoles[_role].contains(_account);
    }

    function getRoles() public view returns (bytes32[] memory) {
        return _allCallers.values();
    }

    function getRoleCount() public view returns (uint256) {
        return _allCallers.length();
    }

    function getRolesViaCursor(uint256 _from, uint256 _to) public view returns (bytes32[] memory) {
        if (_to > _allCallers.length()) {
            _to = _allCallers.length();
        }

        bytes32[] memory roles = new bytes32[](_to - _from);
        for (uint256 i; i < roles.length; i++) {
            roles[i] = _allCallers.at(i);
        }
        return roles;
    }

    function getRoleDatas() external view returns (CallerData[] memory) {
        uint256 count = _allCallers.length();
        CallerData[] memory rollDatas = new CallerData[](count);
        for (uint256 i; i < count; i++) {
            rollDatas[i] = _callerData[_allCallers.at(i)];
        }
        return rollDatas;
    }

    function getRoleDatasViaCursor(uint256 _from, uint256 _to) external view returns (CallerData[] memory) {
        if (_to > _allCallers.length()) {
            _to = _allCallers.length();
        }

        CallerData[] memory roles = new CallerData[](_to - _from);
        for (uint256 i; i < roles.length; i++) {
            roles[i] = _callerData[_allCallers.at(i)];
        }
        return roles;
    }

    function isRole(bytes32 _role) public view returns (bool) {
        return _allCallers.contains(_role);
    }

    function isTimelockComplete(uint256 _transactionId) public view returns (bool) {
        return block.timestamp >= transactions[_transactionId].creationTimestamp + secondsTimeLocked;
    }

    function isTimelockExpired(uint256 _transactionId) public view returns (bool) {
        return block.timestamp >= transactions[_transactionId].creationTimestamp + secondsTimeLocked + secondsValid;
    }

    // ================================================
    // ============= Internal Functions ===============
    // ================================================

    function _ownerSetSecondsTimeLocked(
        uint32 _secondsTimeLocked
    ) internal {
        Require.that(
            _secondsTimeLocked != 0,
            _FILE,
            "Invalid timelock"
        );

        secondsTimeLocked = _secondsTimeLocked;
        emit SecondsTimeLockedChanged(_secondsTimeLocked);
    }

    function _ownerSetSecondsValid(
        uint32 _secondsValid
    ) internal {
        Require.that(
            _secondsValid >= 5 minutes && _secondsValid <= 1 weeks,
            _FILE,
            "Invalid validation window"
        );

        secondsValid = _secondsValid;
        emit SecondsValidChanged(_secondsValid);
    }

    function _verifyTransaction(
        uint256 _transactionId
    ) internal transactionExists(_transactionId) pastTimeLock(msg.sender, _transactionId) {
        Transaction storage txn = transactions[_transactionId];
        Require.that(
            !txn.executed && !txn.verified && !txn.cancelled,
            _FILE,
            "Transaction not verifiable"
        );

        txn.verified = true;
        emit TransactionVerified(_transactionId);
    }

    function _executeTransaction(
        uint256 _transactionId
    ) internal transactionExists(_transactionId) pastTimeLock(msg.sender, _transactionId) returns (bytes memory) {
        Transaction storage txn = transactions[_transactionId];
        Require.that(
            !txn.executed && !txn.cancelled,
            _FILE,
            "Transaction not executable"
        );

        txn.executed = true;
        bytes memory returnData = txn.destination.functionCallWithValue(txn.data, /* value = */ 0);

        emit TransactionExecuted(_transactionId);
        return returnData;
    }

    function _addTransaction(
        address _destination,
        bytes memory _data
    ) internal notNull(_destination) returns (uint256) {
        uint256 transactionId = transactionCount;
        transactions[transactionId] = Transaction({
            destination: _destination,
            data: _data,
            creationTimestamp: block.timestamp,
            executed: false,
            verified: false,
            cancelled : false
        });
        transactionCount += 1;
        emit TransactionSubmitted(transactionId);
        return transactionId;
    }

    function _ownerCancelTransaction(
        uint256 _transactionId
    ) internal transactionExists(_transactionId) {
        Transaction storage txn = transactions[_transactionId];
        Require.that(
            !txn.executed && !txn.cancelled,
            _FILE,
            "Transaction not cancellable"
        );

        txn.cancelled = true;
        emit TransactionCancelled(_transactionId);
    }

    function _isApprovedToSubmitTransaction(
        bytes32 _role,
        address _destination,
        bytes4 _selector
    ) internal view returns (bool) {
        return _callerData[_role].destination == _destination && _callerData[_role].destinationSelector == _selector;
    }

    function _computeCallerRole(
        address _caller,
        address _destination,
        bytes4 _destinationSelector
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(_caller, _destination, _destinationSelector));
    }
}