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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IVeTokenClaim } from "./interfaces/IVeTokenClaim.sol";
import { IVotingEscrow } from "./interfaces/IVotingEscrow.sol";


/**
 * @title   VeTokenClaim
 * @author  Dolomite
 *
 * Claim contract for veDOLO from Boyco rewards
 */
contract VeTokenClaim is BaseClaim, IVeTokenClaim {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VeTokenClaim";
    bytes32 private constant _VE_TOKEN_CLAIM_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.veTokenClaimStorage")) - 1); // solhint-disable-line max-line-length

    uint256 public constant _BOYCO_START_TIME = 1738800000; // Feb 06 2025 00:00:00 UTC

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IERC20 public immutable DOLO; // solhint -disable-line mixed-case
    IVotingEscrow public immutable VE_DOLO; // solhint -disable-line mixed-case

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        address _veDolo,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {
        DOLO = IERC20(_dolo);
        VE_DOLO = IVotingEscrow(_veDolo);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetMarketIdToMerkleRoot(
        uint256 _marketId,
        bytes32 _merkleRoot
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMarketIdToMerkleRoot(_marketId, _merkleRoot);
    }

    // ======================================================
    // ================== Public Functions ==================
    // ======================================================

    function claim(ClaimParams[] memory _claimParams) external onlyClaimEnabled nonReentrant {
        VeTokenClaimStorage storage s = _getVeTokenClaimStorage();
        address user = getUserOrRemappedAddress(msg.sender);

        uint256 totalAmount;
        for (uint256 i = 0; i < _claimParams.length; i++) {
            ClaimParams memory claimParam = _claimParams[i];

            if (_verifyMerkleProof( user, s.marketIdToMerkleRoot[claimParam.marketId], claimParam.proof, claimParam.amount )) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _verifyMerkleProof(
                    user,
                    s.marketIdToMerkleRoot[claimParam.marketId],
                    claimParam.proof,
                    claimParam.amount
                ),
                _FILE,
                "Invalid merkle proof",
                claimParam.marketId
            );
            if (!s.userToMarketIdToClaimStatus[user][claimParam.marketId]) { /* FOR COVERAGE TESTING */ }
            Require.that(
                !s.userToMarketIdToClaimStatus[user][claimParam.marketId],
                _FILE,
                "User already claimed"
            );

            s.userToMarketIdToClaimStatus[user][claimParam.marketId] = true;
            totalAmount += claimParam.amount;
            DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
                user,
                claimParam.marketId, // @follow-up @Corey, do you want an event like this? Or one event per claim with an array?
                claimParam.amount
            );
        }

        DOLO.safeApprove(address(VE_DOLO), totalAmount);
        VE_DOLO.create_lock_for(totalAmount, block.timestamp - _BOYCO_START_TIME, msg.sender);
    }


    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function marketIdToMerkleRoot(uint256 _marketId) external view returns (bytes32) {
        VeTokenClaimStorage storage s = _getVeTokenClaimStorage();
        return s.marketIdToMerkleRoot[_marketId];
    }

    function userToClaimStatus(address _user, uint256 _marketId) external view returns (bool) {
        VeTokenClaimStorage storage s = _getVeTokenClaimStorage();
        return s.userToMarketIdToClaimStatus[_user][_marketId];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetMarketIdToMerkleRoot(uint256 _marketId, bytes32 _merkleRoot) internal virtual {
        VeTokenClaimStorage storage s = _getVeTokenClaimStorage();
        s.marketIdToMerkleRoot[_marketId] = _merkleRoot;
        emit MarketIdToMerkleRootSet(_marketId, _merkleRoot);
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

    function _getVeTokenClaimStorage() internal pure returns (VeTokenClaimStorage storage veTokenClaimStorage) {
        bytes32 slot = _VE_TOKEN_CLAIM_STORAGE_SLOT;
        assembly {
            veTokenClaimStorage.slot := slot
        }
    }
}
