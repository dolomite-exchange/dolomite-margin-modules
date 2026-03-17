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
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IFeeRebateClaimer } from "./interfaces/IFeeRebateClaimer.sol";


/**
 * @title   FeeRebateClaimer
 * @author  Dolomite
 *
 * Claim contract for raking Dolomite borrowing fees
 */
contract FeeRebateClaimer is BaseClaim, IFeeRebateClaimer {
    using TypesLib for IDolomiteStructs.Wei;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "FeeRebateClaimer";
    bytes32 private constant _FEE_REBATE_ROLLING_CLAIMS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.feeRebateRollingClaimsStorage")) - 1); // solhint-disable-line max-line-length

    // ======================================================
    // ==================== Constructor =====================
    // ======================================================

    constructor(address _dolomiteRegistry, address _dolomiteMargin) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetAdminFeeClaimer(address _adminFeeClaimer) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAdminFeeClaimer(_adminFeeClaimer);
    }

    function handlerClaimRewardsByEpochAndMarketId(
        uint256 _epoch,
        uint256[] calldata _marketIds,
        bool _incrementEpoch
    ) external onlyHandler(msg.sender) {
        _handlerClaimRewardsByEpochAndMarketId(_epoch, _marketIds, _incrementEpoch);
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function getClaimAmountByEpochAndMarketId(uint256 _epoch, uint256 _marketId) external view returns (uint256) {
        FeeRebateClaimerStorage storage s = _getFeeRebateClaimerStorage();
        return s.epochToMarketIdToClaimAmountMap[_epoch][_marketId];
    }

    function adminFeeClaimer() public view returns (address) {
        FeeRebateClaimerStorage storage s = _getFeeRebateClaimerStorage();
        return address(s.adminFeeClaimer);
    }

    function epoch() public view returns (uint256) {
        FeeRebateClaimerStorage storage s = _getFeeRebateClaimerStorage();
        return s.epoch;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetAdminFeeClaimer(address _adminFeeClaimer) internal virtual {
        Require.that(
            _adminFeeClaimer != address(0),
            _FILE,
            "Invalid fee claimer address"
        );

        FeeRebateClaimerStorage storage s = _getFeeRebateClaimerStorage();
        s.adminFeeClaimer = IAdminClaimExcessTokens(_adminFeeClaimer);
        emit AdminFeeClaimerSet(_adminFeeClaimer);
    }

    function _handlerClaimRewardsByEpochAndMarketId(
        uint256 _epoch,
        uint256[] memory _marketIds,
        bool _incrementEpoch
    ) internal {
        Require.that(
            _epoch != 0,
            _FILE,
            "Epoch cannot be 0"
        );

        FeeRebateClaimerStorage storage s = _getFeeRebateClaimerStorage();
        Require.that(
            s.epoch + 1 == _epoch,
            _FILE,
            "Invalid epoch",
            s.epoch + 1,
            _epoch
        );

        IAdminClaimExcessTokens _adminFeeClaimer = s.adminFeeClaimer;
        for (uint256 i; i < _marketIds.length; i++) {
            uint256 marketId = _marketIds[i];
            Require.that(
                s.epochToMarketIdToClaimAmountMap[_epoch][marketId] == 0,
                _FILE,
                "Already claimed",
                _epoch,
                marketId
            );

            IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
                owner: address(this),
                number: 0
            });
            IDolomiteStructs.Wei memory balanceBefore = DOLOMITE_MARGIN().getAccountWei(account, marketId);

            address token = DOLOMITE_MARGIN().getMarketTokenAddress(marketId);
            _adminFeeClaimer.claimExcessTokens(token, address(this), true);

            IDolomiteStructs.Wei memory balanceAfter = DOLOMITE_MARGIN().getAccountWei(account, marketId);

            uint256 claimedAmountWei = balanceAfter.sub(balanceBefore).value;
            s.epochToMarketIdToClaimAmountMap[_epoch][marketId] = claimedAmountWei;
            emit MarketIdToFeesClaimed(_epoch, marketId, claimedAmountWei);
        }

        if (_incrementEpoch) {
            s.epoch = uint96(_epoch);
            emit EpochSet(_epoch);
        }
    }

    function _getFeeRebateClaimerStorage(
    ) internal pure returns (FeeRebateClaimerStorage storage feeRebateRollingClaimsStorage) {
        bytes32 slot = _FEE_REBATE_ROLLING_CLAIMS_STORAGE_SLOT;
        assembly {
            feeRebateRollingClaimsStorage.slot := slot
        }
    }
}
