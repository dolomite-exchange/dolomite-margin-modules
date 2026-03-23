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

import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IFeeRebateRollingClaims } from "./interfaces/IFeeRebateRollingClaims.sol";


/**
 * @title   FeeRebateRollingClaims
 * @author  Dolomite
 *
 * Claim contract for fee rebates for veDOLO holders
 */
contract FeeRebateRollingClaims is BaseClaim, IFeeRebateRollingClaims {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "FeeRebateRollingClaims";
    bytes32 private constant _FEE_REBATE_ROLLING_CLAIMS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.feeRebateRollingClaimsStorage")) - 1); // solhint-disable-line max-line-length

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
        _disableInitializers();
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetFeeRebateClaimer(address _feeRebateClaimer) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetFeeRebateClaimer(_feeRebateClaimer);
    }

    function handlerSetMerkleRoots(
        uint256[] calldata _marketIds,
        bytes32[] calldata _merkleRoots,
        uint256[] calldata _totalAmounts,
        uint256 _expectedEpoch
    ) external onlyHandler(msg.sender) {
        Require.that(
            _marketIds.length == _merkleRoots.length && _merkleRoots.length == _totalAmounts.length,
            _FILE,
            "Lengths not aligned"
        );
        Require.that(
            _marketIds.length != 0,
            _FILE,
            "Lengths cannot be 0"
        );
        Require.that(
            _getFeeRebateRollingClaimsStorage().currentEpoch + 1 == _expectedEpoch,
            _FILE,
            "Invalid epoch"
        );

        for (uint256 i; i < _marketIds.length; i++) {
            _ownerSetMarketIdToMerkleRoot(_marketIds[i], _merkleRoots[i], _totalAmounts[i]);
        }

        _getFeeRebateRollingClaimsStorage().currentEpoch = uint96(_expectedEpoch);
    }

    // ======================================================
    // ================== Public Functions ==================
    // ======================================================

    function claim(ClaimParams[] calldata _claimParams) external onlyClaimEnabled nonReentrant {
        for (uint256 i = 0; i < _claimParams.length; i++) {
            _claim(_claimParams[i]);
        }
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function marketIdToClaimAmount(uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.marketIdToMarket[_marketId].claimAmount;
    }

    function marketIdToTotalAmount(uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.marketIdToMarket[_marketId].totalAmount;
    }

    function marketIdToRemainingAmount(uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        MarketStorage storage market = s.marketIdToMarket[_marketId];
        return market.totalAmount - market.claimAmount;
    }

    function marketIdToMerkleRoot(uint256 _marketId) external view returns (bytes32) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.marketIdToMarket[_marketId].merkleRoot;
    }

    function userToMarketIdToClaimAmount(address _user, uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.userToMarketIdToClaimAmount[_user][_marketId];
    }

    function feeRebateClaimer() public view returns (address) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.feeRebateClaimer;
    }

    function currentEpoch() public view returns (uint256) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.currentEpoch;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _claim(ClaimParams memory _claimParams) internal {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        address user = getUserOrRemappedAddress(msg.sender);
        MarketStorage storage market = s.marketIdToMarket[_claimParams.marketId];

        Require.that(
            _verifyMerkleProof(
                user,
                market.merkleRoot,
                _claimParams.proof,
                _claimParams.amount
            ),
            _FILE,
            "Invalid merkle proof",
            _claimParams.marketId
        );
        Require.that(
            _claimParams.amount > s.userToMarketIdToClaimAmount[user][_claimParams.marketId],
            _FILE,
            "No amount to claim"
        );

        // We subtract these two because `_claimParams.amount` is ever-increasing
        uint256 amountToClaim = _claimParams.amount - s.userToMarketIdToClaimAmount[user][_claimParams.marketId];
        s.userToMarketIdToClaimAmount[user][_claimParams.marketId] = _claimParams.amount;

        market.claimAmount += uint128(amountToClaim);

        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            s.feeRebateClaimer,
            0,
            msg.sender,
            0,
            _claimParams.marketId,
            IDolomiteStructs.AssetDenomination.Wei,
            amountToClaim,
            AccountBalanceLib.BalanceCheckFlag.From
        );

        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(user, _claimParams.marketId, amountToClaim);
    }

    function _ownerSetMarketIdToMerkleRoot(uint256 _marketId, bytes32 _merkleRoot, uint256 _newTotal) internal virtual {
        Require.that(
            _merkleRoot != bytes32(0),
            _FILE,
            "Invalid merkle root"
        );
        Require.that(
            _newTotal == uint128(_newTotal) && _newTotal != 0,
            _FILE,
            "Invalid new total"
        );

        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        s.marketIdToMarket[_marketId].totalAmount = uint128(_newTotal);
        s.marketIdToMarket[_marketId].merkleRoot = _merkleRoot;
        emit MarketIdToMerkleRootSet(_marketId, _merkleRoot, _newTotal);
    }

    function _ownerSetFeeRebateClaimer(address _feeRebateClaimer) internal virtual {
        Require.that(
            _feeRebateClaimer != address(0),
            _FILE,
            "Invalid fee rebate address"
        );

        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        s.feeRebateClaimer = _feeRebateClaimer;
        emit FeeRebateClaimerSet(_feeRebateClaimer);
    }

    function _verifyMerkleProof(
        address _user,
        bytes32 _merkleRoot,
        bytes32[] memory _proof,
        uint256 _amount
    ) internal pure returns (bool) {
        bytes32 leaf = keccak256(abi.encode(_user, _amount));
        return MerkleProof.verify(_proof, _merkleRoot, leaf);
    }

    function _getFeeRebateRollingClaimsStorage(
    ) internal pure returns (FeeRebateRollingClaimsStorage storage feeRebateRollingClaimsStorage) {
        bytes32 slot = _FEE_REBATE_ROLLING_CLAIMS_STORAGE_SLOT;
        assembly {
            feeRebateRollingClaimsStorage.slot := slot
        }
    }
}
