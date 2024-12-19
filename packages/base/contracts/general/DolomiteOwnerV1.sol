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

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteOwner } from "../interfaces/IDolomiteOwner.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   DolomiteOwnerV1
 * @author  Dolomite
 *
 * @notice  DolomiteOwnerV1 contract that enables an admin to set roles and permissions for other addresses
 */
contract DolomiteOwnerV1 is IDolomiteOwner, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Address for address;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "DolomiteOwnerV1";

    bytes32 public constant SECURITY_COUNCIL_ROLE = keccak256("SECURITY_COUNCIL_ROLE");
    bytes32 public constant LISTING_COMMITTEE_ROLE = keccak256("LISTING_COMMITTEE_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant BYPASS_TIMELOCK_ROLE = keccak256("BYPASS_TIMELOCK_ROLE");
    address private constant _ADDRESS_ZERO = address(0x0);

    // ================================================
    // =================== State Variables ============
    // ================================================

    EnumerableSet.Bytes32Set private _allRoles;
    mapping(address => EnumerableSet.Bytes32Set) private _userToRoles;
    mapping(bytes32 => EnumerableSet.AddressSet) private _roleToAddresses;
    mapping(bytes32 => EnumerableSet.Bytes32Set) private _roleToFunctionSelectors;
    mapping(bytes32 => mapping(address => EnumerableSet.Bytes32Set)) private _roleToAddressToFunctionSelectors;

    uint32 public secondsTimeLocked;
    mapping (uint256 => Transaction) public transactions;
    uint256 public transactionCount;

    // ================================================
    // =================== Modifiers ================
    // ================================================

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

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(
        address _admin,
        uint32 _secondsTimeLocked
    ) {
        _allRoles.add(BYPASS_TIMELOCK_ROLE);
        _allRoles.add(DEFAULT_ADMIN_ROLE);
        _allRoles.add(EXECUTOR_ROLE);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _ownerSetSecondsTimeLocked(_secondsTimeLocked);
    }

    // ================================================
    // =================== Admin Functions ============
    // ================================================

    function ownerSetSecondsTimeLocked(
        uint32 _secondsTimeLocked
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _ownerSetSecondsTimeLocked(_secondsTimeLocked);
    }

    function ownerAddRole(
        bytes32 _role
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _allRoles.add(_role);
        emit RoleAdded(_role);
    }

    function ownerRemoveRole(
        bytes32 _role
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Require.that(
            _role != DEFAULT_ADMIN_ROLE,
            _FILE,
            "Cannot remove admin role"
        );

        _allRoles.remove(_role);
        emit RoleRemoved(_role);
    }

    function ownerAddRoleAddresses(
        bytes32 _role,
        address[] calldata _addresses
    ) external onlyRole(DEFAULT_ADMIN_ROLE) activeRole(_role) {
        for (uint256 i; i < _addresses.length; i++) {
            _roleToAddresses[_role].add(_addresses[i]);
        }
        emit AddressesAddedToRole(_role, _addresses);
    }

    function ownerRemoveRoleAddresses(
        bytes32 _role,
        address[] calldata _addresses
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i; i < _addresses.length; i++) {
            _roleToAddresses[_role].remove(_addresses[i]);
        }
        emit AddressesRemovedFromRole(_role, _addresses);
    }

    function ownerAddRoleFunctionSelectors(
        bytes32 _role,
        bytes4[] calldata _selectors
    ) external onlyRole(DEFAULT_ADMIN_ROLE) activeRole(_role) {
        for (uint256 i; i < _selectors.length; i++) {
            _roleToFunctionSelectors[_role].add(bytes32(_selectors[i]));
        }
        emit FunctionSelectorsAddedToRole(_role, _selectors);
    }

    function ownerRemoveRoleFunctionSelectors(
        bytes32 _role,
        bytes4[] calldata _selectors
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i; i < _selectors.length; i++) {
            _roleToFunctionSelectors[_role].remove(bytes32(_selectors[i]));
        }
        emit FunctionSelectorsRemovedFromRole(_role, _selectors);
    }

    function ownerAddRoleToAddressFunctionSelectors(
        bytes32 _role,
        address _destination,
        bytes4[] calldata _selectors
    ) external onlyRole(DEFAULT_ADMIN_ROLE) activeRole(_role){
        for (uint256 i; i < _selectors.length; i++) {
            _roleToAddressToFunctionSelectors[_role][_destination].add(_selectors[i]);
        }
        emit FunctionSelectorsAddedToAddress(_role, _destination, _selectors);
    }

    function ownerRemoveRoleToAddressFunctionSelectors(
        bytes32 _role,
        address _destination,
        bytes4[] calldata _selectors
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i; i < _selectors.length; i++) {
            _roleToAddressToFunctionSelectors[_role][_destination].remove(_selectors[i]);
        }
        emit FunctionSelectorsRemovedFromAddress(_role, _destination, _selectors);
    }

    function ownerCancelTransaction(
        uint256 transactionId
    ) external transactionExists(transactionId) onlyRole(DEFAULT_ADMIN_ROLE) {
        Transaction storage txn = transactions[transactionId];
        Require.that(
            !txn.executed && !txn.cancelled,
            _FILE,
            "Transaction not cancellable"
        );

        txn.cancelled = true;
        emit TransactionCancelled(transactionId);
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

    function executeTransaction(
        uint256 _transactionId
    ) public validExecutor(msg.sender) returns (bytes memory){
        return _executeTransaction(_transactionId);
    }

    // ================================================
    // =============== View Functions =================
    // ================================================

    function getRoles() external view returns (bytes32[] memory) {
        return _allRoles.values();
    }

    function getRoleAddresses(
        bytes32 _role
    ) external view returns (address[] memory) {
        return _roleToAddresses[_role].values();
    }

    function getRoleFunctionSelectors(
        bytes32 _role
    ) external view returns (bytes32[] memory) {
        return _roleToFunctionSelectors[_role].values();
    }

    function getRoleToAddressFunctionSelectors(
        bytes32 _role,
        address _destination
    ) external view returns (bytes32[] memory) {
        return _roleToAddressToFunctionSelectors[_role][_destination].values();
    }

    function getUserToRoles(
        address _user
    ) external view returns (bytes32[] memory) {
        return _userToRoles[_user].values();
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

        bytes32[] memory userRoles = _userToRoles[_user].values();
        for (uint256 i; i < userRoles.length; ++i) {
            bytes32 role = userRoles[i];
            if (!isRole(role) || role == EXECUTOR_ROLE || role == BYPASS_TIMELOCK_ROLE) {
                // If the role does not exist, is an executor, or can bypass the timelock, they don't have approval
                // No need to check in the following if statement
                continue;
            }
            if (_isApprovedToSubmitTransaction(role, _destination, _selector)) {
                return true;
            }
        }

        return false;
    }

    function isRole(bytes32 _role) public view returns (bool) {
        return _allRoles.contains(_role);
    }

    function isTimelockComplete(uint256 _transactionId) public view returns (bool) {
        return block.timestamp >= transactions[_transactionId].creationTimestamp + secondsTimeLocked;
    }

    // ================================================
    // ============= Internal Functions ===============
    // ================================================

    function _ownerSetSecondsTimeLocked(
        uint32 _secondsTimeLocked
    ) internal {
        secondsTimeLocked = _secondsTimeLocked;
        emit SecondsTimeLockedChanged(_secondsTimeLocked);
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
            cancelled : false
        });
        transactionCount += 1;
        emit TransactionSubmitted(transactionId);
        return transactionId;
    }

    function _isApprovedToSubmitTransaction(
        bytes32 _role,
        address _destination,
        bytes4 _selector
    ) internal view returns (bool) {

        /*
            We have three mappings:
            _roleToAddressToFunctionSelectors - This contains function selectors for specific addresses
            _roleToAddresses - This contains addresses that can be called with any function
            _roleToFunctionSelectors - This contains function selectors that can be called on any address

            The logic is as follows:
            1. If the role has function selectors for the destination address, check if the selector is approved
            2. If the role has 0 function selectors for the destination address,
                check if the destination address or selector is generally approved
        */
        if (_roleToAddressToFunctionSelectors[_role][_destination].length() != 0) {
            return _roleToAddressToFunctionSelectors[_role][_destination].contains(bytes32(_selector));
        } else {
            return _roleToAddresses[_role].contains(_destination)
                || _roleToFunctionSelectors[_role].contains(bytes32(_selector));
        }
    }

    function _grantRole(bytes32 _role, address _account) internal activeRole(_role) override {
        _userToRoles[_account].add(_role);
        return super._grantRole(_role, _account);
    }

    function _revokeRole(bytes32 _role, address _account) internal activeRole(_role) override {
        _userToRoles[_account].remove(_role);
        return super._revokeRole(_role, _account);
    }
}
