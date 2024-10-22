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
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


/**
 * @title   OptionAirdrop
 * @author  Dolomite
 *
 * Option airdrop contract for DOLO tokens
 */
contract OptionAirdrop is OnlyDolomiteMargin, IOptionAirdrop {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "OptionAirdrop";

    uint256 public constant EPOCH_NUMBER = 0;
    uint256 public constant DOLO_PRICE = .03e18; // Our oracle would expect the price in 18 decimals

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint -disable-line mixed-case
    IERC20 public immutable DOLO; // solhint -disable-line mixed-case

    bytes32 public merkleRoot;
    address public treasury;
    mapping(address => uint256) public userToClaimedAmount;

    EnumerableSet.AddressSet private _allowedPaymentTokens;

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

    function ownerSetAllowedPaymentTokens(address[] memory _tokens, bool[] memory _allowed) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAllowedPaymentTokens(_tokens, _allowed);
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
        address _paymentAsset,
        bool _payFromDolomiteBalance
    ) external {
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
            _allowedPaymentTokens.contains(_paymentAsset),
            _FILE,
            "Payment asset not allowed"
        );

        userToClaimedAmount[msg.sender] += _claimAmount;

        uint256 doloValue = DOLO_PRICE * _claimAmount;
        uint256 paymentAmount = doloValue / DOLOMITE_REGISTRY.oracleAggregator().getPrice(_paymentAsset).value;
        if(_payFromDolomiteBalance) {
            // @todo pay from dolo balance
        } else {
            IERC20(_paymentAsset).safeTransferFrom(msg.sender, address(this), paymentAmount);
        }

        DOLO.safeTransfer(msg.sender, _claimAmount);
        DOLOMITE_REGISTRY.eventEmitter().emitRewardClaimed(
            msg.sender,
            EPOCH_NUMBER,
            _claimAmount
        );
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function getClaimedAmountByUser(address _user) external view returns (uint256) {
        return userToClaimedAmount[_user];
    }

    function getAllowedPaymentTokens() external view returns (address[] memory) {
        return _allowedPaymentTokens.values();
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetAllowedPaymentTokens(address[] memory _tokens, bool[] memory _allowed) internal {
        uint256 len = _tokens.length;
        Require.that(
            len == _allowed.length,
            _FILE,
            "Invalid input lengths"
        );

        for (uint256 i; i < len; i++) {
            if (_allowed[i]) {
                _allowedPaymentTokens.add(_tokens[i]);
            } else {
                _allowedPaymentTokens.remove(_tokens[i]);
            }
        }
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
        // @follow-up Do you want an event here?
    }

    function _verifyMerkleProof(bytes32[] calldata _proof, uint256 _allocatedAmount) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _allocatedAmount));
        return MerkleProof.verifyCalldata(_proof, merkleRoot, leaf);
    }
}