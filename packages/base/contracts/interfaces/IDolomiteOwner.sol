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
 * @title   IDolomiteOwner
 * @author  Dolomite
 *
 * @notice  Interface for the DolomiteOwner contract
 */
interface IDolomiteOwner {

    // ========================================================
    // ======================== Structs =======================
    // ========================================================

    struct Transaction {
        address destination;
        uint256 value;
        bytes data;
        bool executed;
        bool cancelled;
    }

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event RoleAdded(bytes32 indexed _role);
    event RoleRemoved(bytes32 indexed _role);

    event AddressesAddedToRole(bytes32 indexed _role, address[] _address);
    event AddressesRemovedFromRole(bytes32 indexed _role, address[] _address);
    event FunctionSelectorsAddedToRole(bytes32 indexed _role, bytes4[] _selectors);
    event FunctionSelectorsRemovedFromRole(bytes32 indexed _role, bytes4[] _selectors);
    event FunctionSelectorsAddedToAddress(bytes32 indexed _role, address _address, bytes4[] _selectors);
    event FunctionSelectorsRemovedFromAddress(bytes32 indexed _role, address _address, bytes4[] _selectors);

    event TransactionSubmitted(uint256 indexed transactionId);
    event TransactionCancelled(uint256 indexed transactionId);
    event TransactionExecuted(uint256 indexed transactionId);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================


    // ========================================================
    // =================== Transaction Functions ====================
    // ========================================================

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

}
