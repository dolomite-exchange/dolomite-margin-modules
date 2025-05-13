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

import { IBaseClaim } from "./IBaseClaim.sol";


/**
 * @title   IFeeRebateRollingClaims
 * @author  Dolomite
 *
 * @notice  Interface for fee rebate rolling claims contract
 */
interface IFeeRebateRollingClaims is IBaseClaim {

    struct FeeRebateRollingClaimsStorage {
        mapping(address => mapping(uint256 => uint256)) userToMarketIdToClaimAmount;
        mapping(uint256 => bytes32) marketIdToMerkleRoot;
    }

    struct ClaimParams {
        uint256 marketId;
        bytes32[] proof;
        uint256 amount;
    }

    event MarketIdToMerkleRootSet(uint256 marketId, bytes32 merkleRoot);

    // ======================================================
    // ==================== Admin Functions =================
    // ======================================================

    function ownerSetMarketIdToMerkleRoot(uint256 _marketId, bytes32 _merkleRoot) external;

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function claim(ClaimParams[] memory _claimParams) external;

    // ======================================================
    // ==================== View Functions ==================
    // ======================================================

    function marketIdToMerkleRoot(uint256 _marketId) external view returns (bytes32);

    function userToMarketIdToClaimAmount(address _user, uint256 _marketId) external view returns (uint256);
}
