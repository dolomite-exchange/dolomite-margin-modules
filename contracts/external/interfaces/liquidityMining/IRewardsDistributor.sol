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

import { IOARB } from "./IOARB.sol";


/**
 * @title   IRewardsDistributor
 * @author  Dolomite
 *
 * @notice  Interface oARB rewards distributor
 */
interface IRewardsDistributor {

    // ======================================================
    // ======================== Structs =====================
    // ======================================================

    struct ClaimInfo {
        uint256 epoch;
        uint256 amount;
        bytes32[] proof;
    }

    // ======================================================
    // ======================== Events ======================
    // ======================================================

    event MerkleRootSet(uint256 epoch, bytes32 merkleRoot);

    event OARBSet(IOARB oARB);

    event Claimed(address indexed user, uint256 epoch, uint256 amount);

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function ownerSetMerkleRoot(uint256 _epoch, bytes32 _merkleRoot) external;

    function ownerSetOARB(IOARB _oARB) external;

    /**
     *
     * @param  _claimInfo  Array of ClaimInfo structs used to claim oARB for the given user
     */
    function claim(ClaimInfo[] calldata _claimInfo) external;
}
