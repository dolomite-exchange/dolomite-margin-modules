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
import { BaseClaimWithMerkleProof } from "./BaseClaimWithMerkleProof.sol";
import { IVeTokenClaim } from "./interfaces/IVeTokenClaim.sol";
import { IVotingEscrow } from "./interfaces/IVotingEscrow.sol";


/**
 * @title   VeTokenClaim
 * @author  Dolomite
 *
 * Claim contract for veDOLO from Boyco rewards
 */
contract VeTokenClaim is BaseClaimWithMerkleProof, IVeTokenClaim {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VeTokenClaim";
    bytes32 private constant _VE_TOKEN_CLAIM_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.veTokenClaimStorage")) - 1); // solhint-disable-line max-line-length
    uint256 private constant _EPOCH = 0;

    uint256 public constant BOYCO_START_TIME = 1738800000; // Feb 06 2025 00:00:00 UTC

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IERC20 public immutable DOLO; // solhint -disable-line mixed-case
    IVotingEscrow public immutable VE_DOLO; // solhint -disable-line mixed-case
    uint256 public immutable MAX_LOCK_DURATION; // solhint -disable-line mixed-case;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        address _veDolo,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaimWithMerkleProof(_dolomiteRegistry, _dolomiteMargin) {
        DOLO = IERC20(_dolo);
        VE_DOLO = IVotingEscrow(_veDolo);
        MAX_LOCK_DURATION = VE_DOLO.MAXTIME();
    }

    // ======================================================
    // ================== Public Functions ==================
    // ======================================================

    function claim(uint256 _amount, bytes32[] calldata _proof) external onlyClaimEnabled nonReentrant {
        VeTokenClaimStorage storage s = _getVeTokenClaimStorage();
        address user = getUserOrRemappedAddress(msg.sender);

        Require.that(
            _verifyMerkleProof(user, _proof, _amount),
            _FILE,
            "Invalid merkle proof"
        );
        Require.that(
            !s.userToClaimStatus[user],
            _FILE,
            "User already claimed"
        );

        s.userToClaimStatus[user] = true;
        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(user, _EPOCH, _amount);

        DOLO.safeApprove(address(VE_DOLO), _amount);

        Require.that(
            block.timestamp - BOYCO_START_TIME < MAX_LOCK_DURATION,
            _FILE,
            "Past max claim period"
        );
        VE_DOLO.create_lock_for(
            _amount,
            MAX_LOCK_DURATION - (block.timestamp - BOYCO_START_TIME),
            /* _to */ msg.sender
        );
    }


    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function userToClaimStatus(address _user) external view returns (bool) {
        VeTokenClaimStorage storage s = _getVeTokenClaimStorage();
        return s.userToClaimStatus[_user];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _getVeTokenClaimStorage() internal pure returns (VeTokenClaimStorage storage veTokenClaimStorage) {
        bytes32 slot = _VE_TOKEN_CLAIM_STORAGE_SLOT;
        assembly {
            veTokenClaimStorage.slot := slot
        }
    }
}
