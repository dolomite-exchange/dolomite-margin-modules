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

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";


/**
 * @title   IDolomiteOwnerV4
 * @author  Dolomite
 *
 * @notice  Interface for the DolomiteOwnerV4 contract
 */
interface IDolomiteOwnerV4 is IAccessControl {

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
}
