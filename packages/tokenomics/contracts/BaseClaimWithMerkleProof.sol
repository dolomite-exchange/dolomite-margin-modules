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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { BaseClaim } from "./BaseClaim.sol";
import { IBaseClaimWithMerkleProof } from "./interfaces/IBaseClaimWithMerkleProof.sol";


/**
 * @title   BaseClaimWithMerkleProof
 * @author  Dolomite
 *
 * Base contract for merkle root claims
 */
abstract contract BaseClaimWithMerkleProof is BaseClaim, IBaseClaimWithMerkleProof {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "BaseClaimWithMerkleProof";

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(_dolomiteRegistry, _dolomiteMargin) {}

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMerkleRoot(_merkleRoot);
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function merkleRoot() public view virtual returns (bytes32) {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        return s.merkleRoot;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal virtual {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        s.merkleRoot = _merkleRoot;
        emit MerkleRootSet(_merkleRoot);
    }

    function _verifyMerkleProof(
        address _user,
        bytes32[] calldata _proof,
        uint256 _amount
    ) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(_user, _amount));
        return MerkleProof.verifyCalldata(_proof, merkleRoot(), leaf);
    }
}
