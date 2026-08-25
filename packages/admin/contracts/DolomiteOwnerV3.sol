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
import { IDolomiteOwnerV3 } from "./interfaces/IDolomiteOwnerV3.sol";


/**
 * @title   DolomiteOwnerV3
 * @author  Dolomite
 *
 * @notice  DolomiteOwnerV3 contract that enables an admin to set roles and permissions for other addresses
 */
contract DolomiteOwnerV3 is AccessControl, IDolomiteOwnerV3 {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Address for address;

    // ================================================
    // =================== Constants ==================
    // ================================================

    bytes32 private constant _FILE = "DolomiteOwnerV3";
    address private constant _ADDRESS_ZERO = address(0);

    /// @notice Service role
    bytes32 public constant BYPASS_TIMELOCK_ROLE = keccak256("BYPASS_TIMELOCK_ROLE");
    /// @notice Service role
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    /// @notice Protected role
    bytes32 public constant VETO_ROLE = keccak256("VETO_ROLE");

    uint32 public constant FORCED_REVOCATION_SECONDS_VALID = 2 weeks;

    // ================================================
    // =================== State Variables ============
    // ================================================

    uint24 public secondsTimeLocked;
    uint24 public secondsForceRevokeVetoTimeLocked;
    uint24 public secondsValid;
    uint184 public transactionCount;
    mapping (uint256 => Transaction) public transactions;

    mapping(bytes32 => EnumerableSet.AddressSet) private _roleToAddresses;
    mapping(address => EnumerableSet.Bytes32Set) private _addressToRoles;
    EnumerableSet.AddressSet private _allAddresses;

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

    modifier onlyRoleOrDefaultAdmin(address _sender, bytes32 _role) {
        Require.that(
            hasRole(_role, _sender) || hasRole(DEFAULT_ADMIN_ROLE, _sender),
            _FILE,
            "Missing role"
        );
        _;
    }

    modifier pastTimeLock(
        address _sender,
        uint256 _transactionId
    ) {
        Transaction memory txn = transactions[_transactionId];
        if (_isForceRevokeVetoTransaction(txn.destination, txn.data)) {
            Require.that(
                isTimelockComplete(_transactionId),
                _FILE,
                "Force revoke timelock incomplete"
            );
        } else {
            Require.that(
                isTimelockComplete(_transactionId) || hasRole(BYPASS_TIMELOCK_ROLE, _sender),
                _FILE,
                "Timelock incomplete"
            );
        }
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
        uint24 _secondsTimeLocked,
        uint24 _secondsForceRevokeVetoTimeLocked,
        uint24 _secondsValid
    ) AccessControl() {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        _ownerSetSecondsTimeLocked(_secondsTimeLocked);
        _ownerSetSecondsForceRevokeVetoTimeLocked(_secondsForceRevokeVetoTimeLocked);
        _ownerSetSecondsValid(_secondsValid);
    }

    // ================================================
    // =================== Admin Functions ============
    // ================================================

    function ownerTransferDefaultAdmin(address _newAdmin) external onlySelf(msg.sender) {
        address oldAdmin = getDefaultAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, oldAdmin);
    }

    function ownerSetSecondsTimeLocked(
        uint24 _secondsTimeLocked
    ) external onlySelf(msg.sender) {
        _ownerSetSecondsTimeLocked(_secondsTimeLocked);
    }

    function ownerSetSecondsForceRevokeVetoTimeLocked(
        uint24 _secondsForceRevokeVetoTimeLocked
    ) external onlySelf(msg.sender) {
        _ownerSetSecondsForceRevokeVetoTimeLocked(_secondsForceRevokeVetoTimeLocked);
    }

    function ownerSetSecondsValid(
        uint24 _secondsValid
    ) external onlySelf(msg.sender) {
        _ownerSetSecondsValid(_secondsValid);
    }

    function ownerRegisterCaller(
        address _caller,
        ComputedRole[] calldata _roles
    ) external onlySelf(msg.sender) {
        uint256 len = _roles.length;
        Require.that(
            len != 0,
            _FILE,
            "Invalid roles"
        );

        for (uint256 i; i < len; ++i) {
            bytes32 role = calculateRole(_roles[i].selector, _roles[i].destination);
            Require.that(
                role != DEFAULT_ADMIN_ROLE
                    && role != VETO_ROLE
                    && role != EXECUTOR_ROLE
                    && role != BYPASS_TIMELOCK_ROLE,
                _FILE,
                "Invalid computed role"
            );

            _grantRole(role, _caller);
        }
    }

    function ownerUnregisterCaller(
        address _caller,
        bool _unregisterServiceRoles
    ) external onlySelf(msg.sender) {
        Require.that(
            !hasRole(DEFAULT_ADMIN_ROLE, _caller) && !hasRole(VETO_ROLE, _caller),
            _FILE,
            "Cannot remove protected roles"
        );

        bytes32[] memory roles = _addressToRoles[_caller].values();
        for (uint256 i; i < roles.length; ++i) {
            if (roles[i] == BYPASS_TIMELOCK_ROLE || roles[i] == EXECUTOR_ROLE) {
                if (_unregisterServiceRoles) {
                    _revokeRole(roles[i], _caller);
                }
            } else {
                _revokeRole(roles[i], _caller);
            }
        }
    }

    function grantRole(
        bytes32 _role,
        address _account
    ) public override(AccessControl, IAccessControl) onlySelf(msg.sender) {
        Require.that(
            _role != DEFAULT_ADMIN_ROLE,
            _FILE,
            "Invalid grantRole usage"
        );
        _grantRole(_role, _account);
    }

    function revokeRole(
        bytes32 _role,
        address _account
    ) public override(AccessControl, IAccessControl) onlySelf(msg.sender) {
        _revokeRole(_role, _account);
    }

    function forceRevokeVetoRole(
        address _account
    ) public onlySelf(msg.sender) {
        _revokeRole(VETO_ROLE, _account);
    }

    function renounceRole(
        bytes32 /* _role */,
        address /* _account */
    ) public override(AccessControl, IAccessControl) {
        revert("Not implemented");
    }

    // ================================================
    // ============= Transaction Functions ============
    // ================================================

    function cancelTransaction(
        uint256 _transactionId
    ) external onlyRoleOrDefaultAdmin(msg.sender, VETO_ROLE) {
        _cancelTransaction(_transactionId);
    }

    function cancelTransactions(
        uint256[] calldata _transactionIds
    ) external onlyRoleOrDefaultAdmin(msg.sender, VETO_ROLE) {
        for (uint256 i; i < _transactionIds.length; i++) {
            _cancelTransaction(_transactionIds[i]);
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
        bytes4 selector = _getSelectorFromData(_data);

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

    function executeTransaction(
        uint256 _transactionId
    ) public onlyRoleOrDefaultAdmin(msg.sender, EXECUTOR_ROLE) returns (bytes memory) {
        return _executeTransaction(_transactionId);
    }

    function executeTransactions(
        uint256[] memory transactionIds
    ) external onlyRoleOrDefaultAdmin(msg.sender, EXECUTOR_ROLE) returns (bytes[] memory) {
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

    function getBypassTimelockAddresses() external view returns (address[] memory) {
        return _roleToAddresses[BYPASS_TIMELOCK_ROLE].values();
    }

    function getExecutorAddresses() external view returns (address[] memory) {
        return _roleToAddresses[EXECUTOR_ROLE].values();
    }

    function getVetoAddresses() external view returns (address[] memory) {
        return _roleToAddresses[VETO_ROLE].values();
    }

    function getAddressRoles(address _address) external view returns (bytes32[] memory) {
        return _addressToRoles[_address].values();
    }

    function getComputedAddressRoles(address _address) external view returns (ComputedRole[] memory) {
        bytes32[] memory roles = _addressToRoles[_address].values();
        ComputedRole[] memory result = new ComputedRole[](roles.length);

        for (uint256 i; i < roles.length; ++i) {
            if (
                roles[i] != BYPASS_TIMELOCK_ROLE
                && roles[i] != EXECUTOR_ROLE
                && roles[i] != VETO_ROLE
                && roles[i] != DEFAULT_ADMIN_ROLE
            ) {
                (address destination, bytes4 selector) = calculateSelectorAndAddress(roles[i]);
                result[i] = ComputedRole({
                    role: bytes32(0),
                    destination: destination,
                    selector: selector
                });
            } else {
                result[i] = ComputedRole({
                    role: roles[i],
                    destination: address(0),
                    selector: bytes4(0)
                });
            }
        }

        return result;
    }

    function getRoleAddresses(bytes32 _role) external view returns (address[] memory) {
        return _roleToAddresses[_role].values();
    }

    function getAllAddressesWithRoles() external view returns (address[] memory) {
        return _allAddresses.values();
    }

    function getTransactions(
        uint256 _from,
        uint256 _to
    ) external view returns (Transaction[] memory) {
        if (_to > transactionCount) {
            _to = transactionCount;
        }

        Transaction[] memory trans = new Transaction[](_to - _from);
        for (uint256 i = _from; i < _to; ++i) {
            trans[i - _from] = transactions[i];
        }

        return trans;
    }

    function getDefaultAdmin() public view returns (address) {
        address[] memory admins = _roleToAddresses[DEFAULT_ADMIN_ROLE].values();
        assert(admins.length == 1);
        return admins[0];
    }

    function isUserApprovedToSubmitTransaction(
        address _user,
        address _destination,
        bytes4 _selector
    ) public view returns (bool) {
        if (hasRole(DEFAULT_ADMIN_ROLE, _user)) {
            return true;
        }

        // Only the default admin can submit a transaction that resolves to this contract
        Require.that(
            _destination != address(this),
            _FILE,
            "Invalid destination"
        );

        return hasRole(calculateRole(_selector, _destination), _user);
    }

    function isTimelockComplete(uint256 _transactionId) public view returns (bool) {
        return block.timestamp >= transactions[_transactionId].lockedUntil;
    }

    function isTimelockExpired(uint256 _transactionId) public view returns (bool) {
        return block.timestamp >= transactions[_transactionId].validUntil;
    }

    function calculateRole(bytes4 _selector, address _contract) public pure returns (bytes32) {
        return bytes32(_selector) | bytes32(uint256(uint160(_contract)));
    }

    function calculateSelectorAndAddress(bytes32 role) public pure returns (address destination, bytes4 selector) {
        return (address(uint160(uint256(role))), bytes4(role));
    }

    // ================================================
    // ============= Internal Functions ===============
    // ================================================

    function _ownerSetSecondsTimeLocked(
        uint24 _secondsTimeLocked
    ) internal {
        Require.that(
            _secondsTimeLocked >= 60 seconds && _secondsTimeLocked <= 14 days,
            _FILE,
            "Invalid timelock"
        );

        secondsTimeLocked = _secondsTimeLocked;
        emit SecondsTimeLockedChanged(_secondsTimeLocked);
    }

    function _ownerSetSecondsForceRevokeVetoTimeLocked(
        uint24 _secondsForceRevokeVetoTimeLocked
    ) internal {
        Require.that(
            _secondsForceRevokeVetoTimeLocked >= 14 days && _secondsForceRevokeVetoTimeLocked <= 90 days,
            _FILE,
            "Invalid force veto timelock"
        );

        secondsForceRevokeVetoTimeLocked = _secondsForceRevokeVetoTimeLocked;
        emit SecondsForceRevokeVetoTimeLockedChanged(_secondsForceRevokeVetoTimeLocked);
    }

    function _ownerSetSecondsValid(
        uint24 _secondsValid
    ) internal {
        Require.that(
            _secondsValid >= 1 days && _secondsValid <= 2 weeks,
            _FILE,
            "Invalid validation window"
        );

        secondsValid = _secondsValid;
        emit SecondsValidChanged(_secondsValid);
    }

    function _executeTransaction(
        uint256 _transactionId
    )
        internal
        transactionExists(_transactionId)
        pastTimeLock(msg.sender, _transactionId)
        notExpired(_transactionId)
        returns (bytes memory)
    {
        Transaction storage txn = transactions[_transactionId];
        Require.that(
            !txn.executed && !txn.cancelled,
            _FILE,
            "Transaction not executable",
            _transactionId
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
        bool isForceRevokeVeto = _isForceRevokeVetoTransaction(_destination, _data);

        uint24 lockDuration = isForceRevokeVeto ? secondsForceRevokeVetoTimeLocked : secondsTimeLocked;
        uint32 lockedUntil = uint32(block.timestamp) + lockDuration;
        uint32 l_secondsValid = isForceRevokeVeto ? FORCED_REVOCATION_SECONDS_VALID : secondsValid;

        uint256 transactionId = transactionCount;
        transactions[transactionId] = Transaction({
            lockedUntil: lockedUntil,
            validUntil: lockedUntil + l_secondsValid,
            executed: false,
            cancelled : false,
            destination: _destination,
            data: _data
        });
        transactionCount += 1;

        emit TransactionSubmitted(transactionId);
        return transactionId;
    }

    function _cancelTransaction(
        uint256 _transactionId
    ) internal transactionExists(_transactionId) {
        Transaction storage txn = transactions[_transactionId];
        Require.that(
            !txn.executed && !txn.cancelled,
            _FILE,
            "Transaction not cancellable"
        );

        if (_isForceRevokeVetoTransaction(txn.destination, txn.data)) {
            Require.that(
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
                _FILE,
                "Only admin can cancel frc revoke"
            );
        } else if (_isRevokeVetoTransaction(txn.destination, txn.data)) {
            Require.that(
                msg.sender != _getVetoerFromData(txn.data),
                _FILE,
                "Cannot veto own revoke"
            );
        }

        txn.cancelled = true;
        emit TransactionCancelled(_transactionId);
    }

    function _isForceRevokeVetoTransaction(address _destination, bytes memory _data) internal view returns (bool) {
        if (_destination == address(this) && _getSelectorFromData(_data) == this.forceRevokeVetoRole.selector) {
            return true;
        }

        return false;
    }

    function _isRevokeVetoTransaction(address _destination, bytes memory _data) internal view returns (bool) {
        bytes4 selector = _getSelectorFromData(_data);
        bytes32 role = _getRoleFromData(_data);

        if (_destination == address(this) && selector == this.revokeRole.selector && role == VETO_ROLE) {
            return true;
        }

        return false;
    }

    function _grantRole(bytes32 _role, address account) internal override {
        Require.that(
            account != _ADDRESS_ZERO && account != address(this),
            _FILE,
            "Invalid address"
        );

        if (_role == DEFAULT_ADMIN_ROLE) {
            Require.that(
                _addressToRoles[account].length() == 0,
                _FILE,
                "Admin can only have 1 role"
            );
            Require.that(
                account.isContract(),
                _FILE,
                "Admin must be a contract"
            );
        } else {
            Require.that(
                !_addressToRoles[account].contains(DEFAULT_ADMIN_ROLE),
                _FILE,
                "Admin can only have 1 role"
            );
        }

        super._grantRole(_role, account);
        _addressToRoles[account].add(_role);
        _roleToAddresses[_role].add(account);

        if (!_allAddresses.contains(account)) {
            _allAddresses.add(account);
        }
    }

    function _revokeRole(bytes32 role, address account) internal override {
        super._revokeRole(role, account);
        _addressToRoles[account].remove(role);
        _roleToAddresses[role].remove(account);

        if (_addressToRoles[account].length() == 0) {
            _allAddresses.remove(account);
        }

        Require.that(
            _roleToAddresses[DEFAULT_ADMIN_ROLE].length() != 0,
            _FILE,
            "Cannot renounce ownership"
        );
    }

    function _getSelectorFromData(bytes memory _data) internal pure returns (bytes4) {
        bytes32 rawData;

        /* solium-disable-next-line security/no-inline-assembly */
        assembly {
            rawData := mload(add(_data, 32))
        }
        return bytes4(rawData);
    }

    function _getRoleFromData(bytes memory _data) internal pure returns (bytes32 role) {
        /* solium-disable-next-line security/no-inline-assembly */
        assembly {
            role := mload(add(_data, 36))
        }
    }

    function _getVetoerFromData(bytes memory _data) internal pure returns (address vetoer) {
        /* solium-disable-next-line security/no-inline-assembly */
        assembly {
            vetoer := mload(add(_data, 68))
        }
    }
}
