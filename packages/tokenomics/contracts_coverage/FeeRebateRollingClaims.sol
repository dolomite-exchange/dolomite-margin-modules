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

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _feeRebateAddress,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
        _ownerSetFeeRebateAddress(_feeRebateAddress);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetFeeRebateAddress(address _feeRebateAddress) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetFeeRebateAddress(_feeRebateAddress);
    }

    function ownerSetMarketIdToMerkleRoot(
        uint256 _marketId,
        bytes32 _merkleRoot
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMarketIdToMerkleRoot(_marketId, _merkleRoot);
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

    function feeRebateAddress() external view returns (address) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.feeRebateAddress;
    }

    function marketIdToMerkleRoot(uint256 _marketId) external view returns (bytes32) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.marketIdToMerkleRoot[_marketId];
    }

    function userToMarketIdToClaimAmount(address _user, uint256 _marketId) external view returns (uint256) {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        return s.userToMarketIdToClaimAmount[_user][_marketId];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _claim(ClaimParams memory _claimParams) internal {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        address user = getUserOrRemappedAddress(msg.sender);

        if (_verifyMerkleProof( user, s.marketIdToMerkleRoot[_claimParams.marketId], _claimParams.proof, _claimParams.amount )) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _verifyMerkleProof(
                user,
                s.marketIdToMerkleRoot[_claimParams.marketId],
                _claimParams.proof,
                _claimParams.amount
            ),
            _FILE,
            "Invalid merkle proof",
            _claimParams.marketId
        );
        if (_claimParams.amount > s.userToMarketIdToClaimAmount[user][_claimParams.marketId]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _claimParams.amount > s.userToMarketIdToClaimAmount[user][_claimParams.marketId],
            _FILE,
            "No amount to claim"
        );

        uint256 amountToClaim = _claimParams.amount - s.userToMarketIdToClaimAmount[user][_claimParams.marketId];
        s.userToMarketIdToClaimAmount[user][_claimParams.marketId] = _claimParams.amount;

        IERC20 token = IERC20(DOLOMITE_MARGIN().getMarketTokenAddress(_claimParams.marketId));
        token.safeTransferFrom(s.feeRebateAddress, address(this), amountToClaim);

        token.safeApprove(address(DOLOMITE_MARGIN()), amountToClaim);
        AccountActionLib.deposit(
            DOLOMITE_MARGIN(),
            msg.sender,
            address(this),
            0,
            _claimParams.marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: amountToClaim
            })
        );

        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(user, _claimParams.marketId, amountToClaim);
    }

    function _ownerSetMarketIdToMerkleRoot(uint256 _marketId, bytes32 _merkleRoot) internal virtual {
        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        s.marketIdToMerkleRoot[_marketId] = _merkleRoot;
        emit MarketIdToMerkleRootSet(_marketId, _merkleRoot);
    }

    function _ownerSetFeeRebateAddress(address _feeRebateAddress) internal virtual {
        if (_feeRebateAddress != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _feeRebateAddress != address(0),
            _FILE,
            "Invalid fee rebate address"
        );

        FeeRebateRollingClaimsStorage storage s = _getFeeRebateRollingClaimsStorage();
        s.feeRebateAddress = _feeRebateAddress;
        emit FeeRebateAddressSet(_feeRebateAddress);
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
