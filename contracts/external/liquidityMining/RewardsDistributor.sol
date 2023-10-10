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

    mapping(uint256 => bytes32) public merkleRoots;
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

    function claim(ClaimInfo[] calldata _claimInfo) external {
        uint256 len = _claimInfo.length;
        for (uint256 i; i < len; i++) {
            Require.that(
                _verifyMerkleProof(_claimInfo[i]),
                _FILE,
                "Invalid merkle proof"
            );
            Require.that(
                !claimStatus[msg.sender][_claimInfo[i].epoch],
                _FILE,
                "Already claimed"
            );
            claimStatus[msg.sender][_claimInfo[i].epoch] = true;
            oARB.mint(_claimInfo[i].amount);
            oARB.transfer(msg.sender, _claimInfo[i].amount);

            emit Claimed(msg.sender, _claimInfo[i].epoch, _claimInfo[i].amount);
        }
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetMerkleRoot(uint256 _epoch, bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        merkleRoots[_epoch] = _merkleRoot;
        emit MerkleRootSet(_epoch, _merkleRoot);
    }

    function ownerSetOARB(IOARB _oARB) external onlyDolomiteMarginOwner(msg.sender) {
        oARB = _oARB;
        emit OARBSet(_oARB);
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _verifyMerkleProof(ClaimInfo calldata _claimInfo) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _claimInfo.amount));
        return MerkleProof.verifyCalldata(_claimInfo.proof, merkleRoots[_claimInfo.epoch], leaf);
    }
}
