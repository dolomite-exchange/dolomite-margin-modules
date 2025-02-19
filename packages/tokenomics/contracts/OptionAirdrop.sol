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
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IOptionAirdrop } from "./interfaces/IOptionAirdrop.sol";


/**
 * @title   OptionAirdrop
 * @author  Dolomite
 *
 * Option airdrop contract for DOLO tokens
 */
contract OptionAirdrop is OnlyDolomiteMargin, ReentrancyGuard, IOptionAirdrop {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "OptionAirdrop";

    uint256 public constant DOLO_PRICE = 0.03125 ether;

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line mixed-case
    IERC20 public immutable DOLO; // solhint-disable-line mixed-case

    bytes32 public merkleRoot;
    address public treasury;
    mapping(address => uint256) public userToClaimedAmount;
    mapping(address => uint256) public userToPurchases;

    EnumerableSet.UintSet private _allowedMarketIds;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolo,
        address _treasury,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLO = IERC20(_dolo);
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);

        _ownerSetTreasury(_treasury);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetAllowedMarketIds(
        uint256[] memory _marketIds
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAllowedMarketIds(_marketIds);
    }

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMerkleRoot(_merkleRoot);
    }

    function ownerSetTreasury(address _treasury) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetTreasury(_treasury);
    }

    function ownerWithdrawRewardToken(address _token, address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerWithdrawRewardToken(_token, _receiver);
    }

    // ==============================================================
    // ======================= User Functions =======================
    // ==============================================================

    function claim(
        bytes32[] calldata _proof,
        uint256 _allocatedAmount,
        uint256 _claimAmount,
        uint256 _marketId,
        uint256 _fromAccountNumber
    ) external nonReentrant {
        Require.that(
            _verifyMerkleProof(_proof, _allocatedAmount),
            _FILE,
            "Invalid merkle proof"
        );
        Require.that(
            userToClaimedAmount[msg.sender] + _claimAmount <= _allocatedAmount,
            _FILE,
            "Insufficient allocated amount"
        );
        Require.that(
            _allowedMarketIds.contains(_marketId),
            _FILE,
            "Payment asset not allowed"
        );

        userToClaimedAmount[msg.sender] += _claimAmount;

        uint256 doloValue = DOLO_PRICE * _claimAmount;
        uint256 paymentAmount = doloValue / DOLOMITE_MARGIN().getMarketPrice(_marketId).value;
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN(),
            msg.sender,
            _fromAccountNumber,
            treasury,
            _marketId,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: paymentAmount
            }),
            AccountBalanceLib.BalanceCheckFlag.From
        );

        DOLO.safeTransfer(msg.sender, _claimAmount);
        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
            msg.sender,
            userToPurchases[msg.sender]++,
            _claimAmount
        );
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function isAllowedMarketId(uint256 _marketId) external view returns (bool) {
        return _allowedMarketIds.contains(_marketId);
    }

    function getAllowedMarketIds() external view returns (uint256[] memory) {
        return _allowedMarketIds.values();
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetAllowedMarketIds(uint256[] memory _marketIds) internal {
        // Clear out current set
        uint256 len = _allowedMarketIds.length();
        for (uint256 i; i < len; i++) {
            _allowedMarketIds.remove(_allowedMarketIds.at(0));
        }

        len = _marketIds.length;
        for (uint256 i; i < len; i++) {
            _allowedMarketIds.add(_marketIds[i]);
        }
        emit AllowedMarketIdsSet(_marketIds);
    }

    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal {
        merkleRoot = _merkleRoot;
        emit MerkleRootSet(_merkleRoot);
    }

    function _ownerSetTreasury(address _treasury) internal {
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    function _ownerWithdrawRewardToken(address _token, address _receiver) internal {
        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_receiver, bal);
        emit RewardTokenWithdrawn(_token, bal, _receiver);
    }

    function _verifyMerkleProof(bytes32[] calldata _proof, uint256 _allocatedAmount) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _allocatedAmount));
        return MerkleProof.verifyCalldata(_proof, merkleRoot, leaf);
    }
}
