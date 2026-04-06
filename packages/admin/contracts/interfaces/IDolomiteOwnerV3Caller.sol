// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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
 * @title   IDolomiteOwnerV3Caller
 * @author  Dolomite
 *
 * @notice  Interface for the AdminPauseMarket contract
 */
interface IDolomiteOwnerV3Caller {

    // ========================================================
    // ======================= Structs ========================
    // ========================================================

    struct CallerRegistration {
        /// @notice The contract that `validCaller` can invoke
        address destination;
        /// @notice The function selector that `validCaller` can invoke on `destination`
        bytes4 destinationSelector;
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function getAdminRoleRegistrationData() external view returns (CallerRegistration[] memory);

}
