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

import { IAdminClaimExcessTokens } from "@dolomite-exchange/modules-admin/contracts/interfaces/IAdminClaimExcessTokens.sol"; // solhint-disable-line max-line-length
import { IFeeRebateRollingClaims } from "./IFeeRebateRollingClaims.sol";


/**
 * @title   IFeeRebateClaimer
 * @author  Dolomite
 *
 * @notice  Interface for claiming fees from DolomiteMargin
 */
interface IFeeRebateClaimer {

    struct FeeRebateClaimerStorage {
        /// @notice 1-based epoch
        uint96 epoch;
        IAdminClaimExcessTokens adminFeeClaimer;
        IFeeRebateRollingClaims feeRebateRollingClaims;
        address revenueSweeper;
        mapping(uint256 => mapping(uint256 => uint256)) epochToMarketIdToClaimAmountMap;
    }

    event AdminFeeClaimerSet(address adminFeeClaimer);
    event FeeRebateRollingClaimsSet(address feeRebateRollingClaims);
    event RevenueSweeperSet(address revenueSweeper);
    event MarketIdToFeesClaimed(uint256 epoch, uint256 marketId, uint256 claimedAmountWei);
    event EpochSet(uint256 epoch);

    // ======================================================
    // ==================== Admin Functions =================
    // ======================================================

    function ownerSetAdminFeeClaimer(address _adminFeeClaimer) external;

    function ownerSetFeeRebateRollingClaims(address _feeRebateRollingClaims) external;

    function ownerSetRevenueSweeper(address _revenueSweeper) external;

    function handlerClaimRewardsByEpochAndMarketId(
        uint256 _epoch,
        uint256[] calldata _marketIds,
        bool _incrementEpoch
    ) external;

    function handlerSweepRevenue(uint256[] calldata _marketIds) external;

    // ======================================================
    // ==================== View Functions ==================
    // ======================================================

    function getClaimAmountByEpochAndMarketId(uint256 _epoch, uint256 _marketId) external view returns (uint256);

    function adminFeeClaimer() external view returns (address);

    function feeRebateRollingClaims() external view returns (IFeeRebateRollingClaims);

    function revenueSweeper() external view returns (address);

    /// @notice 1-based epoch
    function epoch() external view returns (uint256);

    function getSweepableAmountsByMarketIds(
        uint256[] calldata _marketIds
    ) external view returns (uint256[] memory sweepableAmounts);
}
