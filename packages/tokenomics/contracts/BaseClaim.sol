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
import { IBaseClaim } from "./interfaces/IBaseClaim.sol";


/**
 * @title   BaseClaim
 * @author  Dolomite
 *
 * Base contract for merkle root claims
 */
abstract contract BaseClaim is OnlyDolomiteMargin, IBaseClaim {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "BaseClaim";

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint -disable-line mixed-case

    bytes32 public merkleRoot;
    mapping(address => address) public addressRemapping;

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMerkleRoot(_merkleRoot);
    }

    function ownerSetAddressRemapping(
        address[] memory _users, address[] memory _remappedAddresses
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAddressRemapping(_users, _remappedAddresses);
    }

    function ownerWithdrawRewardToken(address _token, address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerWithdrawRewardToken(_token, _receiver);
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function getAddressRemapping(address _user) external view returns (address) {
        return addressRemapping[_user];
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetAddressRemapping(address[] memory _users, address[] memory _remappedAddresses) internal {
        Require.that(
            _users.length == _remappedAddresses.length,
            _FILE,
            "Array length mismatch"
        );
        for (uint256 i = 0; i < _users.length; i++) {
            addressRemapping[_users[i]] = _remappedAddresses[i];
        }
        emit AddressRemappingSet(_users, _remappedAddresses);
    }

    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal {
        merkleRoot = _merkleRoot;
        emit MerkleRootSet(_merkleRoot);
    }

    function _ownerWithdrawRewardToken(address _token, address _receiver) internal {
        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_receiver, bal);
    }

    function _verifyMerkleProof(
        address _user,
        bytes32[] calldata _proof,
        uint256 _amount
    ) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encode(_user, _amount));
        return MerkleProof.verifyCalldata(_proof, merkleRoot, leaf);
    }
}