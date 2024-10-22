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
import { IERC20Mintable } from "./interfaces/IERC20Mintable.sol";
import { IVotingEscrow } from "./interfaces/IVotingEscrow.sol";
import { IOptionAirdrop } from "./interfaces/IOptionAirdrop.sol";

import "hardhat/console.sol";

/**
 * @title   OptionAirdrop
 * @author  Dolomite
 *
 * Option airdrop contract for DOLO tokens
 */
contract OptionAirdrop is OnlyDolomiteMargin, IOptionAirdrop {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "OptionAirdrop";

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IERC20 public immutable DOLO; // solhint -disable-line mixed-case

    bytes32 public merkleRoot;
    mapping(address => uint256) public userToClaimedAmount;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLO = IERC20(_dolo);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMerkleRoot(_merkleRoot);
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim(bytes32[] calldata _proof, uint256 _allocatedAmount, uint256 _claimAmount) external {
        if (_verifyMerkleProof(_proof, _allocatedAmount)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _verifyMerkleProof(_proof, _allocatedAmount),
            _FILE,
            "Invalid merkle proof"
        );
        if (userToClaimedAmount[msg.sender] + _claimAmount <= _allocatedAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            userToClaimedAmount[msg.sender] + _claimAmount <= _allocatedAmount,
            _FILE,
            "User already claimed"
        );

        userToClaimedAmount[msg.sender] += _claimAmount;
        // @todo do payment logic

        DOLO.safeTransfer(msg.sender, _claimAmount);
        // @todo use event emitter and epoch 0
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function getClaimedAmountByUser(address _user) external view returns (uint256) {
        return userToClaimedAmount[_user];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal {
        merkleRoot = _merkleRoot;
        emit MerkleRootSet(_merkleRoot);
    }

    function _verifyMerkleProof(bytes32[] calldata _proof, uint256 _amount) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _amount));
        return MerkleProof.verifyCalldata(_proof, merkleRoot, leaf);
    }
}
