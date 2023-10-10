// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

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

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IOARB } from "../interfaces/liquidityMining/IOARB.sol";
import { IRewardsDistributor } from "../interfaces/liquidityMining/IRewardsDistributor.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "hardhat/console.sol";


/**
 * @title   RewardsDistributor
 * @author  Dolomite
 *
 * RewardsDistributor contract for oARB tokens
 */
contract RewardsDistributor is OnlyDolomiteMargin, IRewardsDistributor {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "RewardsDistributor";

    // ===================================================
    // ==================== State Variables ====================
    // ===================================================

    bytes32 public merkleRoot;
    mapping(address => mapping(uint256 => bool)) public claimStatus;
    IOARB public oARB;

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin,
        IOARB _oARB
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        oARB = _oARB;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function claim(uint256[] calldata _epochs, uint256[] calldata _amounts, bytes32[] calldata _proof) external {
        if (_epochs.length == _amounts.length) { /* FOR COVERAGE TESTING */ }
        Require.that(_epochs.length == _amounts.length,
            _FILE,
            "Array length mismatch"
        );
        uint256 len = _epochs.length;
        if (_verifyMerkleProof(_epochs, _amounts, _proof)) { /* FOR COVERAGE TESTING */ }
        Require.that(_verifyMerkleProof(_epochs, _amounts, _proof),
            _FILE,
            "Invalid merkle proof"
        );
        for (uint256 i; i < len; i++) {
            if(!claimStatus[msg.sender][_epochs[i]]) {
                claimStatus[msg.sender][_epochs[i]] = true;
                oARB.mint(_amounts[i]);
                oARB.transfer(msg.sender, _amounts[i]);

                emit Claimed(msg.sender, _epochs[i], _amounts[i]);
            }
        }
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        merkleRoot = _merkleRoot;
        emit MerkleRootSet(_merkleRoot);
    }

    function ownerSetOARB(IOARB _oARB) external onlyDolomiteMarginOwner(msg.sender) {
        oARB = _oARB;
        emit OARBSet(_oARB);
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _verifyMerkleProof(uint256[] calldata _epochs, uint256[] calldata _amounts, bytes32[] calldata _proof) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _epochs, _amounts));
        return MerkleProof.verifyCalldata(_proof, merkleRoot, leaf);
    }
}
