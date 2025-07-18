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
import { IRollingClaims } from "./interfaces/IRollingClaims.sol";


/**
 * @title   RollingClaims
 * @author  Dolomite
 *
 * Rolling claims contract that allows the owner to update the merkle root and users can claim
 * on an ongoing basis.
 */
contract RollingClaims is BaseClaimWithMerkleProof, IRollingClaims {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "RollingClaims";
    bytes32 private constant _ROLLING_CLAIMS_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.rollingClaimsStorage")) - 1); // solhint-disable-line max-line-length

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IERC20 public immutable ODOLO; // solhint -disable-line mixed-case

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _odolo,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaimWithMerkleProof(_dolomiteRegistry, _dolomiteMargin) {
        ODOLO = IERC20(_odolo);
    }

    // ==============================================================
    // ======================= Write Functions ======================
    // ==============================================================

    function handlerSetMerkleRoot(bytes32 _merkleRoot, uint256 _expectedEpoch) external onlyHandler(msg.sender) {
        _ownerSetMerkleRoot(_merkleRoot);
        Require.that(
            _getRollingClaimsStorage().currentEpoch == _expectedEpoch,
            _FILE,
            "Invalid epoch"
        );
    }

    function claim(bytes32[] calldata _proof, uint256 _amount) external onlyClaimEnabled nonReentrant {
        RollingClaimsStorage storage s = _getRollingClaimsStorage();
        address user = getUserOrRemappedAddress(msg.sender);

        Require.that(
            _verifyMerkleProof(user, _proof, _amount),
            _FILE,
            "Invalid merkle proof"
        );
        Require.that(
            _amount > s.userToClaimAmount[user],
            _FILE,
            "No amount to claim"
        );

        uint256 amountToClaim = _amount - s.userToClaimAmount[user];
        s.userToClaimAmount[user] = _amount;
        s.userToClaimEpoch[user] = s.currentEpoch;

        ODOLO.safeTransfer(msg.sender, amountToClaim);
        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(user, s.currentEpoch, amountToClaim);
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function currentEpoch() external view returns (uint256) {
        RollingClaimsStorage storage s = _getRollingClaimsStorage();
        return s.currentEpoch;
    }

    function userToClaimAmount(address _user) external view returns (uint256) {
        RollingClaimsStorage storage s = _getRollingClaimsStorage();
        return s.userToClaimAmount[_user];
    }

    function userToClaimEpoch(address _user) external view returns (uint256) {
        RollingClaimsStorage storage s = _getRollingClaimsStorage();
        return s.userToClaimEpoch[_user];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================


    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal override {
        bytes32 merkleRootBefore = _getBaseClaimStorage().merkleRoot;
        super._ownerSetMerkleRoot(_merkleRoot);

        if (merkleRootBefore != bytes32(0)) {
            // First epoch starts at 0
            _getRollingClaimsStorage().currentEpoch += 1;
        }
    }

    function _getRollingClaimsStorage() internal pure returns (RollingClaimsStorage storage rollingClaimsStorage) {
        bytes32 slot = _ROLLING_CLAIMS_STORAGE_SLOT;
        assembly {
            rollingClaimsStorage.slot := slot
        }
    }
}
