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

    struct MarketStorage {
        /// @notice Total amount of Market that's been claimed by users. `remainingAmount = totalAmount - claimAmount`
        uint128 claimAmount;
        /// @notice Total amount of Market that's been rewarded to users. `remainingAmount = totalAmount - claimAmount`
        uint128 totalAmount;
        /// @notice Merkle root of the current claim
        bytes32 merkleRoot;
    }

    struct FeeRebateRollingClaimsStorage {
        address feeRebateClaimer;
        mapping(address => mapping(uint256 => uint256)) userToMarketIdToClaimAmount;
        mapping(uint256 => MarketStorage) marketIdToMarket;
    }

    struct ClaimParams {
        uint256 marketId;
        bytes32[] proof;
        uint256 amount;
    }

    event MarketIdToMerkleRootSet(uint256 marketId, bytes32 merkleRoot, uint256 totalAmount);
    event FeeRebateAddressSet(address feeRebateAddress);

    // ======================================================
    // ==================== Admin Functions =================
    // ======================================================

    function ownerSetFeeRebateAddress(address _feeRebateAddress) external;

    /* solhint-disable max-line-length */

    /**
     *
     * @param  _marketId    The market ID whose merkle root and total will be set
     * @param  _merkleRoot  The new merkle root used for claiming rewards this week
     * @param  _totalAmount The new total amount of `_marketId` that's been allocated to claims. This should be set via
     *                      `this.marketIdToTotalAmount(_marketId) + feeRebateClaimer.getClaimAmountByEpochAndMarketId(latest, _marketId)`
     */
    function handlerSetMarketIdToMerkleRoot(uint256 _marketId, bytes32 _merkleRoot, uint256 _totalAmount) external;

    /* solhint-enable max-line-length */

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function claim(ClaimParams[] memory _claimParams) external;

    // ======================================================
    // ==================== View Functions ==================
    // ======================================================

    function marketIdToClaimAmount(uint256 _marketId) external view returns (uint256);

    function marketIdToTotalAmount(uint256 _marketId) external view returns (uint256);

    function marketIdToRemainingAmount(uint256 _marketId) external view returns (uint256);

    function marketIdToMerkleRoot(uint256 _marketId) external view returns (bytes32);

    function userToMarketIdToClaimAmount(address _user, uint256 _marketId) external view returns (uint256);

    function feeRebateClaimer() external view returns (address);
}
