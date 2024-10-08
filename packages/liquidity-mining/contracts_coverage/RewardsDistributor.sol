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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { IERC20Mintable } from "./interfaces/IERC20Mintable.sol";
import { IRewardsDistributor } from "./interfaces/IRewardsDistributor.sol";


/**
 * @title   RewardsDistributor
 * @author  Dolomite
 *
 * Rewards Distributor contract for token tokens
 */
contract RewardsDistributor is OnlyDolomiteMargin, IRewardsDistributor {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "RewardsDistributor";

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint -disable-line mixed-case

    IERC20Mintable public override token;

    mapping(address => bool) private _handlerMap;
    mapping(uint256 => bytes32) private _epochToMerkleRootMap;
    mapping(address => mapping(uint256 => bool)) private _userToEpochToClaimStatusMap;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    modifier onlyHandler(address _from) {
        if (_handlerMap[_from]) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _handlerMap[_from],
            _FILE,
            "Only handler can call",
            _from
        );
        _;
    }

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolomiteMargin,
        IERC20Mintable _token,
        address[] memory _initialHandlers,
        address _dolomiteRegistry
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        token = _token;

        for (uint256 i; i < _initialHandlers.length; ++i) {
            _ownerSetHandler(_initialHandlers[i], /* _isHandler = */ true);
        }

        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetHandler(address _handler, bool _isHandler) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHandler(_handler, _isHandler);
    }

    function ownerSetMerkleRoot(uint256 _epoch, bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMerkleRoot(_epoch, _merkleRoot);
    }

    function handlerSetMerkleRoot(uint256 _epoch, bytes32 _merkleRoot) external onlyHandler(msg.sender) {
        _ownerSetMerkleRoot(_epoch, _merkleRoot);
    }

    function ownerSetToken(IERC20Mintable _token) external onlyDolomiteMarginOwner(msg.sender) {
        token = _token;
        emit TokenSet(_token);
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim(ClaimInfo[] calldata _claimInfo) external {
        uint256 len = _claimInfo.length;
        if (len > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            len > 0,
            _FILE,
            "Invalid claim infos"
        );

        uint256 claimAmount = 0;
        for (uint256 i; i < len; ++i) {
            if (_verifyMerkleProof(_claimInfo[i])) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _verifyMerkleProof(_claimInfo[i]),
                _FILE,
                "Invalid merkle proof"
            );
            if (!_userToEpochToClaimStatusMap[msg.sender][_claimInfo[i].epoch]) { /* FOR COVERAGE TESTING */ }
            Require.that(
                !_userToEpochToClaimStatusMap[msg.sender][_claimInfo[i].epoch],
                _FILE,
                "Already claimed"
            );

            _userToEpochToClaimStatusMap[msg.sender][_claimInfo[i].epoch] = true;
            claimAmount += _claimInfo[i].amount;
            DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
                msg.sender,
                _claimInfo[i].epoch,
                _claimInfo[i].amount
            );
        }

        token.mint(claimAmount);
        IERC20(address(token)).safeTransfer(msg.sender, claimAmount);
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function isHandler(address _from) external view returns (bool) {
        return _handlerMap[_from];
    }

    function getMerkleRootByEpoch(uint256 _epoch) external view returns (bytes32) {
        return _epochToMerkleRootMap[_epoch];
    }

    function getClaimStatusByUserAndEpoch(address _user, uint256 _epoch) external view returns (bool) {
        return _userToEpochToClaimStatusMap[_user][_epoch];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetHandler(address _handler, bool _isHandler) internal {
        _handlerMap[_handler] = _isHandler;
        emit HandlerSet(_handler, _isHandler);
    }

    function _ownerSetMerkleRoot(uint256 _epoch, bytes32 _merkleRoot) internal {
        _epochToMerkleRootMap[_epoch] = _merkleRoot;
        emit MerkleRootSet(_epoch, _merkleRoot);
    }

    function _verifyMerkleProof(ClaimInfo calldata _claimInfo) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _claimInfo.amount));
        return MerkleProof.verifyCalldata(_claimInfo.proof, _epochToMerkleRootMap[_claimInfo.epoch], leaf);
    }
}
