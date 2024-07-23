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
 * @title   IMNTIsolationModeTokenVaultV1.sol
 * @author  Dolomite
 *
 * @notice  This interface defines the functions that are available on the MNTIsolationModeTokenVaultV1.sol implementation
 *          contract for each user's proxy vault.
 */
interface IARBIsolationModeTokenVaultV1 {

    /**
     *
     * @param  _delegatee   The address to which this vault should delegate its voting power
     */
    function delegate(address _delegatee) external;

    /**
     *
     * @return The address to which this vault is delegating. Defaults to the vault owner
     */
    function delegates() external view returns (address);
}
