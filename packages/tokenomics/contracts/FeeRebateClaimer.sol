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
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IFeeRebateClaimer } from "./interfaces/IFeeRebateClaimer.sol";
import { IFeeRebateRollingClaims } from "./interfaces/IFeeRebateRollingClaims.sol";


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
    /// @notice Thursday May 21, 2026 @ 00:00:00
    uint256 private constant _START_TIMESTAMP = 1779321600;
    uint256 private constant _ONE_WEEK_SECONDS = 7 days;

    // ======================================================
    // ==================== Constructor =====================
    // ======================================================

    constructor(address _dolomiteRegistry, address _dolomiteMargin) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
    }

    function initialize() public override {
        uint256 epochTimestamp = block.timestamp / _ONE_WEEK_SECONDS * _ONE_WEEK_SECONDS;
        uint96 epoch = uint96((epochTimestamp - _START_TIMESTAMP) / _ONE_WEEK_SECONDS); // safe cast

        _getFeeRebateClaimerStorage().currentEpoch = epoch;
        emit EpochSet(epoch);

        super.initialize();
        initializeV2(
            /* _epochs = */ new uint256[](0),
            /* _timestamps = */ new uint256[](0),
            /* _marketIds = */ new uint256[](0)
        );
        initializeV4(/* _marketIds = */ new uint256[](0));
    }

    function initializeV2(
        uint256[] memory _epochs,
        uint256[] memory _timestamps,
        uint256[] memory _marketIds
    ) public reinitializer(2) {
        Require.that(
            _epochs.length == _timestamps.length,
            _FILE,
            "Invalid epochs or timestamps"
        );

        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        for (uint256 i; i < _epochs.length; ++i) {
            Require.that(
                _timestamps[i] < block.timestamp,
                _FILE,
                "Invalid timestamp",
                _timestamps[i]
            );

            for (uint j; j < _marketIds.length; ++j) {
                $.epochToMarketIdToClaimTimestampMap[_epochs[i]][_marketIds[j]] = _timestamps[i];
            }
        }
    }

    function initializeV4(uint256[] memory _marketIds) public reinitializer(4) {
        if (_marketIds.length == 0) {
            return;
        }
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();

        uint256[] memory totals = new uint256[](_marketIds.length);
        uint256 epoch = currentEpoch();
        // Epochs are 1-based
        for (uint256 i = 1; i <= epoch; ++i) {
            for (uint256 j; j < _marketIds.length; ++j) {
                totals[j] += $.epochToMarketIdToClaimAmountMap[i][_marketIds[j]];
            }
        }

        for (uint256 i; i < _marketIds.length; ++i) {
            $.marketIdToTotalClaimAmountMap[_marketIds[i]] = totals[i];
            emit MarketIdTotalFeesUpdated(_marketIds[i], totals[i]);
        }
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetAdminFeeClaimer(address _adminFeeClaimer) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAdminFeeClaimer(_adminFeeClaimer);
    }

    function ownerSetFeeRebateRollingClaims(
        address _feeRebateRollingClaims
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetFeeRebateRollingClaims(_feeRebateRollingClaims);
    }

    function ownerSetRevenueSweeper(address _revenueSweeper) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRevenueSweeper(_revenueSweeper);
    }

    function handlerSweepRevenue(uint256[] calldata _marketIds) external onlyHandler(msg.sender) {
        Require.that(
            _marketIds.length != 0,
            _FILE,
            "Invalid marketIds"
        );

        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        IFeeRebateRollingClaims _feeRebateRollingClaims = $.feeRebateRollingClaims;

        Require.that(
            currentEpoch() == _feeRebateRollingClaims.currentEpoch(),
            _FILE,
            "Epoch mismatch"
        );

        uint256[] memory sweepableAmounts = getSweepableAmountsByMarketIds(_marketIds);

        for (uint256 i; i < _marketIds.length; i++) {
            if (sweepableAmounts[i] != 0) {
                AccountActionLib.transfer(
                    DOLOMITE_MARGIN(),
                    address(this),
                    0,
                    revenueSweeper(),
                    0,
                    _marketIds[i],
                    IDolomiteStructs.AssetDenomination.Wei,
                    sweepableAmounts[i],
                    AccountBalanceLib.BalanceCheckFlag.Both
                );
            }
        }
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
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        return $.epochToMarketIdToClaimAmountMap[_epoch][_marketId];
    }

    function getTotalClaimAmountByMarketId(uint256 _marketId) external view returns (uint256) {
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        return $.marketIdToTotalClaimAmountMap[_marketId];
    }

    function getClaimTimestampByEpochAndMarketId(uint256 _epoch, uint256 _marketId) external view returns (uint256) {
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        return $.epochToMarketIdToClaimTimestampMap[_epoch][_marketId];
    }

    function adminFeeClaimer() public view returns (address) {
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        return address($.adminFeeClaimer);
    }

    function feeRebateRollingClaims() public view returns (IFeeRebateRollingClaims) {
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        return $.feeRebateRollingClaims;
    }

    function revenueSweeper() public view returns (address) {
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        return $.revenueSweeper;
    }

    function currentEpoch() public view returns (uint256) {
        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        return $.currentEpoch;
    }

    function getSweepableAmountsByMarketIds(
        uint256[] calldata _marketIds
    ) public view returns (uint256[] memory) {
        IFeeRebateRollingClaims _feeRebateRollingClaims = feeRebateRollingClaims();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: 0
        });
        uint256[] memory sweepableAmounts = new uint256[](_marketIds.length);
        for (uint256 i; i < _marketIds.length; i++) {
            IDolomiteStructs.Wei memory balance = DOLOMITE_MARGIN().getAccountWei(account, _marketIds[i]);
            assert(balance.sign || balance.value == 0);

            uint256 totalAmount = _feeRebateRollingClaims.marketIdToTotalAmount(_marketIds[i]);
            uint256 claimAmount = _feeRebateRollingClaims.marketIdToClaimAmount(_marketIds[i]);

            // Sweepable amount is equal to: Total amount held in this contract - (total amount - claimed)
            sweepableAmounts[i] = balance.value - (totalAmount - claimAmount);
        }

        return sweepableAmounts;
    }

    function startTimestamp() public pure returns (uint256) {
        return _START_TIMESTAMP;
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

        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        $.adminFeeClaimer = IAdminClaimExcessTokens(_adminFeeClaimer);
        emit AdminFeeClaimerSet(_adminFeeClaimer);
    }

    function _ownerSetFeeRebateRollingClaims(address _feeRebateRollingClaims) internal virtual {
        Require.that(
            _feeRebateRollingClaims != address(0),
            _FILE,
            "Invalid fee rebate claims"
        );

        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        $.feeRebateRollingClaims = IFeeRebateRollingClaims(_feeRebateRollingClaims);
        emit FeeRebateRollingClaimsSet(_feeRebateRollingClaims);
    }

    function _ownerSetRevenueSweeper(address _revenueSweeper) internal virtual {
        Require.that(
            _revenueSweeper != address(0),
            _FILE,
            "Invalid revenue sweeper"
        );

        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        $.revenueSweeper = _revenueSweeper;
        emit RevenueSweeperSet(_revenueSweeper);
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

        FeeRebateClaimerStorage storage $ = _getFeeRebateClaimerStorage();
        Require.that(
            $.currentEpoch + 1 == _epoch,
            _FILE,
            "Invalid epoch",
            $.currentEpoch + 1,
            _epoch
        );
        Require.that(
            block.timestamp >= startTimestamp() + (_ONE_WEEK_SECONDS * _epoch),
            _FILE,
            "Epoch not passed yet",
            startTimestamp() + (_ONE_WEEK_SECONDS * _epoch)
        );

        IAdminClaimExcessTokens adminFeeClaimer_ = $.adminFeeClaimer;
        for (uint256 i; i < _marketIds.length; i++) {
            uint256 marketId = _marketIds[i];
            Require.that(
                $.epochToMarketIdToClaimAmountMap[_epoch][marketId] == 0,
                _FILE,
                "Already claimed",
                _epoch,
                marketId
            );

            uint256 previousTotalClaimedAmount = $.marketIdToTotalClaimAmountMap[marketId];
            uint256 claimedAmountWei = _performClaim(adminFeeClaimer_, marketId);
            $.epochToMarketIdToClaimAmountMap[_epoch][marketId] = claimedAmountWei;
            $.epochToMarketIdToClaimTimestampMap[_epoch][marketId] = block.timestamp;
            $.marketIdToTotalClaimAmountMap[marketId] = previousTotalClaimedAmount + claimedAmountWei;
            emit MarketIdToFeesClaimed(_epoch, marketId, claimedAmountWei);
            emit MarketIdTotalFeesUpdated(marketId, previousTotalClaimedAmount + claimedAmountWei);
        }

        if (_incrementEpoch) {
            $.currentEpoch = uint96(_epoch);
            emit EpochSet(_epoch);
        }
    }

    function _performClaim(IAdminClaimExcessTokens _adminFeeClaimer, uint256 _marketId) internal returns (uint256) {
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: 0
        });
        IDolomiteStructs.Wei memory balanceBefore = DOLOMITE_MARGIN().getAccountWei(account, _marketId);

        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        _adminFeeClaimer.claimExcessTokens(token, address(this), true);

        IDolomiteStructs.Wei memory balanceAfter = DOLOMITE_MARGIN().getAccountWei(account, _marketId);

        IDolomiteStructs.Wei memory claimedAmount = balanceAfter.sub(balanceBefore);
        assert(claimedAmount.isZero() || claimedAmount.isPositive());

        return claimedAmount.value;
    }

    function _getFeeRebateClaimerStorage(
    ) internal pure returns (FeeRebateClaimerStorage storage feeRebateRollingClaimsStorage) {
        bytes32 slot = _FEE_REBATE_ROLLING_CLAIMS_STORAGE_SLOT;
        assembly {
            feeRebateRollingClaimsStorage.slot := slot
        }
    }
}
