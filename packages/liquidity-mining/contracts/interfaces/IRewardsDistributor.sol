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

import { IERC20Mintable } from "./IERC20Mintable.sol";


/**
 * @title   IRewardsDistributor
 * @author  Dolomite
 *
 * @notice  Interface for token rewards distributor
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

    event HandlerSet(address indexed handler, bool isHandler);

    event MerkleRootSet(uint256 epoch, bytes32 merkleRoot);

    event TokenSet(IERC20Mintable token);

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function ownerSetHandler(address _handler, bool _isHandler) external;

    function ownerSetMerkleRoot(uint256 _epoch, bytes32 _merkleRoot) external;

    function handlerSetMerkleRoot(uint256 _epoch, bytes32 _merkleRoot) external;

    function ownerSetToken(IERC20Mintable _token) external;

    /**
     *
     * @param  _claimInfo  Array of ClaimInfo structs used to claim token for the given user
     */
    function claim(ClaimInfo[] calldata _claimInfo) external;

    /**
     *
     * @param  _from    The address tp check if it is a handler
     * @return          True if the address is a handler, false otherwise
     */
    function isHandler(address _from) external view returns (bool);

    /**
     *
     * @param  _epoch   Epoch to get the merkle root for
     * @return          Merkle root for the given epoch
     */
    function getMerkleRootByEpoch(uint256 _epoch) external view returns (bytes32);

    /**
     *
     * @param  _user    User to get the claim status for
     * @param  _epoch   Epoch to get the claim status for
     * @return          True if the user has claimed for the given epoch, false otherwise
     */
    function getClaimStatusByUserAndEpoch(address _user, uint256 _epoch) external view returns (bool);

    function token() external view returns (IERC20Mintable);
}
