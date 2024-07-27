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
 * @title   DolomiteOwner
 * @author  Dolomite
 *
 * @notice  DolomiteOwner contract that enables an admin to set roles and permissions for other addresses
 */
contract DolomiteOwner is IDolomiteOwner, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Address for address;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "DolomiteOwner";

    bytes32 public constant SECURITY_COUNCIL_ROLE = keccak256("SECURITY_COUNCIL_ROLE");
    bytes32 public constant LISTING_COMMITTEE_ROLE = keccak256("LISTING_COMMITTEE_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    address constant ADDRESS_ZERO = address(0x0);

    // ================================================
    // =================== State Variables ============
    // ================================================

    EnumerableSet.Bytes32Set private _roles;
    mapping(address => EnumerableSet.Bytes32Set) private _userToRoles;
    mapping(bytes32 => EnumerableSet.AddressSet) private _roleToAddresses;
    mapping(bytes32 => EnumerableSet.Bytes32Set) private _roleToFunctionSelectors;
    mapping(bytes32 => mapping(address => EnumerableSet.Bytes32Set)) private _roleToAddressToFunctionSelectors;

    mapping (uint256 => Transaction) public transactions;
    uint256 public transactionCount;

    // ================================================
    // =================== Modifiers ================
    // ================================================

    modifier notNull(address _address) {
        Require.that(
            _address != ADDRESS_ZERO,
            _FILE,
            "Address is null"
        );
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        Require.that(
            transactions[transactionId].destination != ADDRESS_ZERO,
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
            _roles.contains(_role),
            _FILE,
            "Invalid role"
        );
        _;
    }

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _roles.add(DEFAULT_ADMIN_ROLE);
    }

    // ================================================
    // =================== Admin Functions ============
    // ================================================

    function ownerAddRole(
        bytes32 _role
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _roles.add(_role);
        emit RoleAdded(_role);
    }

    function ownerRemoveRole(
        bytes32 _role
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _roles.remove(_role);
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
        uint256 _value,
        bytes memory _data
    ) external returns (bytes memory) {
        uint256 transactionId = submitTransaction(_destination, _value, _data);
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
        uint256 _value,
        bytes memory _data
    ) public returns (uint256) {
        bytes4 selector;
        if (_data.length == 0) {
            selector = 0x00000000;
        } else {
            bytes32 rawData;
            /* solium-disable-next-line security/no-inline-assembly */
            assembly {
                rawData := mload(add(_data, 32))
            }
            selector = bytes4(rawData);
        }

        /*
        Logic to check if user has permission to submit the transaction
        1. If user has DEFAULT_ADMIN_ROLE, they can submit the transaction
        2. If user does not have DEFAULT_ADMIN,
            3. Loop through the user's roles and for each role
                4. If the role is no longer valid, transaction is not approved
                5. If the role is valid, check if the transaction is approved for that role
        */
        bool approved;
        if (hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            approved = true;
        } else {
            bytes32[] memory userRoles = _userToRoles[msg.sender].values();
            for (uint256 i; i < userRoles.length; ++i) {
                bytes32 role = userRoles[i];
                if (!_roles.contains(role) || role == EXECUTOR_ROLE) {
                    // If the role does not exist or is an executor, they don't have approval
                    // No need to check inthe following if statement
                    continue;
                }
                if (_checkApprovedTransaction(role, _destination, selector)) {
                    approved = true;
                    break;
                }
            }
        }

        Require.that(
            approved,
            _FILE,
            "Transaction not approved"
        );
        return _addTransaction(_destination, _value, _data);
    }

    function executeTransaction(
        uint256 transactionId
    ) public validExecutor(msg.sender) returns (bytes memory){
        return _executeTransaction(transactionId);
    }

    // ================================================
    // =============== View Functions =================
    // ================================================

    function getRoles() external view returns (bytes32[] memory) {
        return _roles.values();
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

    // @follow-up I adjusted this logic a bit from the original repo. Can you double check my logic?
    function getTransactionIds(
        uint256 from,
        uint256 to,
        bool pending,
        bool executed
    ) external view returns (uint256[] memory) {
        if (to > transactionCount) {
            to = transactionCount;
        }
        uint256[] memory transactionIdsTemp = new uint256[](to - from);
        uint256 count = 0;
        uint256 i;
        for (i = from; i < to; ++i) {
            if (
                (pending && !transactions[i].executed && !transactions[i].cancelled)
                || (executed && transactions[i].executed)
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

    // ================================================
    // ============= Internal Functions ===============
    // ================================================

    function _executeTransaction(
        uint256 transactionId
    ) internal transactionExists(transactionId) returns (bytes memory) {
        Transaction storage txn = transactions[transactionId];
        Require.that(
            !txn.executed && !txn.cancelled,
            _FILE,
            "Transaction not executable"
        );

        txn.executed = true;
        bytes memory returnData = txn.destination.functionCallWithValue(txn.data, txn.value);

        emit TransactionExecuted(transactionId);
        return returnData;
    }

    function _addTransaction(
        address destination,
        uint256 value,
        bytes memory data
    ) internal notNull(destination) returns (uint256) {
        uint256 transactionId = transactionCount;
        transactions[transactionId] = Transaction({
            destination: destination,
            value: value,
            data: data,
            executed: false,
            cancelled: false
        });
        transactionCount += 1;
        emit TransactionSubmitted(transactionId);
        return transactionId;
    }

    function _checkApprovedTransaction(
        bytes32 _role,
        address _destination,
        bytes4 _selector
    ) internal view returns (bool) {

        /*
        We have three mappings:
        _roleToAddressToFunctionSelectors - This contains specific function selectors for specific addresses
        _roleToAddresses - This contains addresses that can be called with any function
        _roleToFunctionSelectors - This contains function selectors that can be called on any address
        
        The logic is as follows:
        1. If the role has specific function selectors for the destination address, check if the selector is approved
        2. If the role has 0 specific function selectors for the destination address,
            check if the destination address or selector is generally approved
        */
        if (_roleToAddressToFunctionSelectors[_role][_destination].length() != 0) {
            return _roleToAddressToFunctionSelectors[_role][_destination].contains(bytes32(_selector));
        } else {
            return _roleToAddresses[_role].contains(_destination)
                || _roleToFunctionSelectors[_role].contains(bytes32(_selector));
        }
    }

    function _grantRole(bytes32 role, address account) internal override {
        _userToRoles[account].add(role);
        return super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal override {
        _userToRoles[account].remove(role);
        return super._revokeRole(role, account);
    }
}
