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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { IRegularAirdrop } from "./interfaces/IRegularAirdrop.sol";
import { IVotingEscrow } from "./interfaces/IVotingEscrow.sol";


/**
 * @title   RegularAirdrop
 * @author  Dolomite
 *
 * Regular airdrop contract for DOLO tokens. 50% is given to the user and 50% is locked in veDolo
 */
contract RegularAirdrop is OnlyDolomiteMargin, IRegularAirdrop {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "RegularAirdrop";

    uint256 public constant MAX_LOCK = 2 * 365 * 86400;
    uint256 public constant EPOCH_NUMBER = 0;

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint -disable-line mixed-case
    IERC20 public immutable DOLO; // solhint -disable-line mixed-case
    IVotingEscrow public immutable VE_DOLO; // solhint -disable-line mixed-case

    bytes32 public merkleRoot;
    mapping(address => bool) public userToClaimStatus;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        address _veDolo,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLO = IERC20(_dolo);
        VE_DOLO = IVotingEscrow(_veDolo);
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMerkleRoot(_merkleRoot);
    }

    function ownerWithdrawRewardToken(address _token, address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerWithdrawRewardToken(_token, _receiver);
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim(bytes32[] calldata _proof, uint256 _amount) external {
        if (_verifyMerkleProof(_proof, _amount)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _verifyMerkleProof(_proof, _amount),
            _FILE,
            "Invalid merkle proof"
        );
        if (!userToClaimStatus[msg.sender]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !userToClaimStatus[msg.sender],
            _FILE,
            "User already claimed"
        );

        userToClaimStatus[msg.sender] = true;

        uint256 veDoloAmount = _amount / 2;
        DOLO.safeApprove(address(VE_DOLO), veDoloAmount);
        VE_DOLO.create_lock_for(veDoloAmount, MAX_LOCK, msg.sender);
        DOLO.safeTransfer(msg.sender, _amount - veDoloAmount);

        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
            msg.sender,
            EPOCH_NUMBER,
            _amount
        );
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function getClaimStatusByUser(address _user) external view returns (bool) {
        return userToClaimStatus[_user];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal {
        merkleRoot = _merkleRoot;
        emit MerkleRootSet(_merkleRoot);
    }

    function _ownerWithdrawRewardToken(address _token, address _receiver) internal {
        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_receiver, bal);
    }

    function _verifyMerkleProof(bytes32[] calldata _proof, uint256 _amount) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _amount));
        return MerkleProof.verifyCalldata(_proof, merkleRoot, leaf);
    }
}
