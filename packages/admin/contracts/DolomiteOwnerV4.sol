// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite

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
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteOwnerV4 } from "./interfaces/IDolomiteOwnerV4.sol";


/**
 * @title   DolomiteOwnerV4
 * @author  Dolomite
 *
 * @notice  DolomiteOwnerV4 contract that enables an admin to set roles and permissions for other addresses
 */
contract DolomiteOwnerV4 is AccessControl, IDolomiteOwnerV4 {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Address for address;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "DolomiteOwnerV4";
    address private constant _ADDRESS_ZERO = address(0x0);

    bytes32 public constant BYPASS_TIMELOCK_ROLE = keccak256("BYPASS_TIMELOCK_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ================================================
    // =================== State Variables ============
    // ================================================

    mapping(bytes32 => EnumerableSet.AddressSet) private _roleToAddresses;
    mapping(address => EnumerableSet.Bytes32Set) private _addressToRoles;
    EnumerableSet.AddressSet private _validCallers;

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

    modifier onlyRoleOrDefaultAdmin(bytes32 _role) {
        Require.that(
            hasRole(_role, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            _FILE,
            "Missing role"
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
    ) AccessControl() {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

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

    function ownerRegisterCaller(
        address _caller,
        address[] memory _contracts,
        bytes4[] memory _functionSelectors
    ) external onlySelf(msg.sender) {
        _validCallers.add(_caller);

        uint256 len = _contracts.length;
        Require.that(
            len == _functionSelectors.length,
            _FILE,
            "Invalid arrays"
        );

        for (uint256 i; i < len; ++i) {
            bytes32 role = calculateRole(_functionSelectors[i], _contracts[i]);
            _grantRole(role, _caller);
        }
    }

    function ownerUnregisterCaller(
        address _caller,
        address[] memory _contracts,
        bytes4[] memory _functionSelectors
    ) external onlySelf(msg.sender) {
        _validCallers.remove(_caller);

        uint256 len = _contracts.length;
        Require.that(
            len == _functionSelectors.length,
            _FILE,
            "Invalid arrays"
        );

        for (uint256 i; i < len; ++i) {
            bytes32 role = calculateRole(_functionSelectors[i], _contracts[i]);
            _revokeRole(role, _caller);
        }
    }

    function grantRoles(
        address _caller,
        address[] memory _contracts,
        bytes4[] memory _functionSelectors
    ) external onlySelf(msg.sender) {
        uint256 len = _contracts.length;
        Require.that(
            len == _functionSelectors.length,
            _FILE,
            "Invalid arrays"
        );

        for (uint256 i; i < len; ++i) {
            bytes32 role = calculateRole(_functionSelectors[i], _contracts[i]);
            _grantRole(role, _caller);
        }
    }

    function grantRole(bytes32 _role, address _account) public override(AccessControl, IAccessControl) onlySelf(msg.sender) {
        _grantRole(_role, _account);
    }

    function revokeRoles(
        address _caller,
        address[] memory _contracts,
        bytes4[] memory _functionSelectors
    ) external onlySelf(msg.sender) {
        uint256 len = _contracts.length;
        Require.that(
            len == _functionSelectors.length,
            _FILE,
            "Invalid arrays"
        );

        for (uint256 i; i < len; ++i) {
            bytes32 role = calculateRole(_functionSelectors[i], _contracts[i]);
            _revokeRole(role, _caller);
        }
    }

    function revokeRole(bytes32 _role, address _account) public override(AccessControl, IAccessControl) onlySelf(msg.sender) {
        _revokeRole(_role, _account);
    }

    // ================================================
    // ============= Transaction Functions ============
    // ================================================

    function ownerCancelTransaction(
        uint256 _transactionId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _ownerCancelTransaction(_transactionId);
    }

    function ownerCancelTransactions(
        uint256[] calldata _transactionIds
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i; i < _transactionIds.length; i++) {
            _ownerCancelTransaction(_transactionIds[i]);
        }
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

        Require.that(
            isUserApprovedToSubmitTransaction(msg.sender, _destination, selector),
            _FILE,
            "Transaction not approved"
        );

        return _addTransaction(_destination, _data);
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

    function verifyTransaction(uint256 _transactionId) external onlyRoleOrDefaultAdmin(VERIFIER_ROLE) {
        _verifyTransaction(_transactionId);
    }

    function verifyTransactions(uint256[] calldata _transactionIds) external onlyRoleOrDefaultAdmin(VERIFIER_ROLE) {
        for (uint256 i; i < _transactionIds.length; i++) {
            _verifyTransaction(_transactionIds[i]);
        }
    }

    function executeTransaction(
        uint256 _transactionId
    ) public onlyRoleOrDefaultAdmin(EXECUTOR_ROLE) returns (bytes memory){
        return _executeTransaction(_transactionId);
    }

    function executeTransactions(
        uint256[] memory transactionIds
    ) external onlyRoleOrDefaultAdmin(EXECUTOR_ROLE) returns (bytes[] memory) {
        bytes[] memory returnDatas = new bytes[](transactionIds.length);
        for (uint256 i; i < transactionIds.length; i++) {
            returnDatas[i] = _executeTransaction(transactionIds[i]);
        }

        return returnDatas;
    }

    function submitTransactionAndExecute(
        address _destination,
        bytes memory _data
    ) external returns (bytes memory) {
        uint256 transactionId = submitTransaction(_destination, _data);
        return executeTransaction(transactionId);
    }

    // ================================================
    // =============== View Functions =================
    // ================================================

    function getUserRoles(address _user) external view returns (bytes32[] memory) {
        return _addressToRoles[_user].values();
    }

    function getRoleAddresses(address _contract, bytes4 _selector) external view returns (address[] memory) {
        return _roleToAddresses[calculateRole(_selector, _contract)].values();
    }

    function getRoleAddresses(bytes32 _role) external view returns (address[] memory) {
        return _roleToAddresses[_role].values();
    }

    function getValidCallers() external view returns (address[] memory) {
        return _validCallers.values();
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
        if (hasRole(DEFAULT_ADMIN_ROLE, _user)) {
            return true;
        }

        Require.that(
            _destination != address(this),
            _FILE,
            "Invalid destination"
        );
        Require.that(
            _validCallers.contains(_user),
            _FILE,
            "Invalid caller"
        );

        return hasRole(calculateRole(_selector, _destination), _user);
    }

    function isTimelockComplete(uint256 _transactionId) public view returns (bool) {
        return block.timestamp >= transactions[_transactionId].creationTimestamp + secondsTimeLocked;
    }

    function isTimelockExpired(uint256 _transactionId) public view returns (bool) {
        return block.timestamp >= transactions[_transactionId].creationTimestamp + secondsTimeLocked + secondsValid;
    }

    function calculateRole(bytes4 _selector, address _contract) public pure returns (bytes32) {
        return bytes32(_selector) | bytes32(uint256(uint160(_contract)));
    }

    function calculateSelectorAndAddress(bytes32 role) public pure returns (bytes4, address) {
        return (bytes4(role), address(uint160(uint256(role))));
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

    function _grantRole(bytes32 role, address account) internal override {
        super._grantRole(role, account);
        _addressToRoles[account].add(role);
        _roleToAddresses[role].add(account);
    }

    function _revokeRole(bytes32 role, address account) internal override {
        super._revokeRole(role, account);
        _addressToRoles[account].remove(role);
        _roleToAddresses[role].remove(account);
    }
}