// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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
import { IRegularAirdrop } from "./interfaces/IRegularAirdrop.sol";
import { IVotingEscrow } from "./interfaces/IVotingEscrow.sol";


/**
 * @title   RegularAirdrop
 * @author  Dolomite
 *
 * Regular airdrop contract for DOLO tokens. 50% is given to the user and 50% is locked in veDolo
 */
contract RegularAirdrop is BaseClaim, IRegularAirdrop {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "RegularAirdrop";
    bytes32 private constant _REGULAR_AIRDROP_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.regularAirdropStorage")) - 1); // solhint-disable-line max-line-length

    uint256 public constant MAX_LOCK = 2 * 365 * 86400;
    uint256 public constant EPOCH_NUMBER = 0;

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

    function ownerSetUserToFullDolo(
        address[] memory _users,
        bool[] memory _fullDolo
    ) external onlyHandler(msg.sender) {
        _ownerSetUserToFullDolo(_users, _fullDolo);
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim(bytes32[] calldata _proof, uint256 _amount) external onlyClaimEnabled nonReentrant {
        RegularAirdropStorage storage s = _getRegularAirdropStorage();
        address user = getUserOrRemappedAddress(msg.sender);

        if (_verifyMerkleProof(user, _proof, _amount)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _verifyMerkleProof(user, _proof, _amount),
            _FILE,
            "Invalid merkle proof"
        );
        if (!s.userToClaimStatus[user]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !s.userToClaimStatus[user],
            _FILE,
            "User already claimed"
        );
        s.userToClaimStatus[user] = true;

        if (s.userToFullDolo[user]) {
            DOLO.safeTransfer(msg.sender, _amount);
        } else {
            uint256 veDoloAmount = _amount / 2;
            DOLO.safeApprove(address(VE_DOLO), veDoloAmount);
            VE_DOLO.create_lock_for(veDoloAmount, MAX_LOCK, msg.sender);
            DOLO.safeTransfer(msg.sender, _amount - veDoloAmount);
        }

        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
            user,
            EPOCH_NUMBER,
            _amount
        );
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function userToClaimStatus(address _user) external view returns (bool) {
        RegularAirdropStorage storage s = _getRegularAirdropStorage();
        return s.userToClaimStatus[_user];
    }

    function userToFullDolo(address _user) external view returns (bool) {
        RegularAirdropStorage storage s = _getRegularAirdropStorage();
        return s.userToFullDolo[_user];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetUserToFullDolo(address[] memory _users, bool[] memory _fullDolo) internal {
        RegularAirdropStorage storage s = _getRegularAirdropStorage();

        if (_users.length == _fullDolo.length) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _users.length == _fullDolo.length,
            _FILE,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < _users.length; i++) {
            s.userToFullDolo[_users[i]] = _fullDolo[i];
        }
        emit UserToFullDoloSet(_users, _fullDolo);
    }

    function _getRegularAirdropStorage() internal pure returns (RegularAirdropStorage storage regularAirdropStorage) {
        bytes32 slot = _REGULAR_AIRDROP_STORAGE_SLOT;
        assembly {
            regularAirdropStorage.slot := slot
        }
    }
}
