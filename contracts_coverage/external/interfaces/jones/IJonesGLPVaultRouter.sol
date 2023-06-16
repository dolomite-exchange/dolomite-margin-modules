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
 * @title   IJonesGLPVaultRouter
 * @author  Dolomite
 *
 * @notice  Interface for interacting with Jones DAO's GLP vault router (0x2F43c6475f1ecBD051cE486A9f3Ccc4b03F3d713)
 */
interface IJonesGLPVaultRouter {

    /**
     * This is toggled by calling this function from the governor (0xDD0556DDCFE7CdaB3540E7F09cB366f498d90774)
     */
    function toggleEmergencyPause() external;

    /**
     * Withdraws `_shares` of jUSDC from the vault and sends the USDC to the caller. Assuming the caller is whitelisted,
     * this function will redeem the jUSDC for USDC immediately instead of enqueueing it.
     */
    function stableWithdrawalSignal(uint256 _shares, bool _compound) external returns (uint256);

    /**
     * @return True if redemptions for jUSDC are paused and cannot be processed.
     */
    function emergencyPaused() external view returns (bool);

    /**
     * Checks if the role hash and account have the role or not
     */
    function hasRole(bytes32 _role, address _account) external view returns (bool);
}
