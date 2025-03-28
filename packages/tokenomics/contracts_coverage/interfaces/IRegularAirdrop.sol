// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IBaseClaim } from "./IBaseClaim.sol";


/**
 * @title   IRegularAirdrop
 * @author  Dolomite
 *
 * @notice  Interface for DOLO regular airdrop contract
 */
interface IRegularAirdrop is IBaseClaim {

    struct RegularAirdropStorage {
        mapping(address => bool) userToClaimStatus;
        mapping(address => bool) userToFullDolo;
    }

    // ======================================================
    // ======================== Events ======================
    // ======================================================

    event UserToFullDoloSet(address[] users, bool[] fullDolo);

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function ownerSetUserToFullDolo(address[] memory _users, bool[] memory _fullDolo) external;

    function claim(bytes32[] memory _proof, uint256 _amount) external;

    function userToClaimStatus(address _user) external view returns (bool);

    function userToFullDolo(address _user) external view returns (bool);
}
