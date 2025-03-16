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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol"; // solhint-disable-line max-line-length
import { ReentrancyGuardUpgradeable } from "@dolomite-exchange/modules-base/contracts/helpers/ReentrancyGuardUpgradeable.sol"; // solhint-disable-line max-line-length
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
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
abstract contract BaseClaim is OnlyDolomiteMargin, ReentrancyGuardUpgradeable, Initializable, IBaseClaim {
    using SafeERC20 for IERC20;

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "BaseClaim";
    bytes32 private constant _BASE_CLAIM_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.baseClaimStorage")) - 1); // solhint-disable-line max-line-length

    // ===================================================
    // ==================== State Variables ==============
    // ===================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint -disable-line mixed-case

    // ===========================================================
    // ======================= Modifiers =======================
    // ===========================================================

    modifier onlyHandler(address _sender) {
        Require.that(
            _sender == handler(),
            _FILE,
            "Only handler can call"
        );
        _;
    }

    modifier onlyClaimEnabled() {
        Require.that(
            claimEnabled(),
            _FILE,
            "Claim is not enabled"
        );
        _;
    }

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(address _dolomiteRegistry, address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function initialize() public virtual initializer {
        __ReentrancyGuardUpgradeable__init();
    }

    // ======================================================
    // ================== Admin Functions ===================
    // ======================================================

    function ownerSetAddressRemapping(
        address[] memory _users,
        address[] memory _remappedAddresses
    ) external onlyHandler(msg.sender) {
        _ownerSetAddressRemapping(_users, _remappedAddresses);
    }

    function ownerSetClaimEnabled(bool _enabled) external onlyHandler(msg.sender) {
        _ownerSetClaimEnabled(_enabled);
    }

    function ownerSetHandler(address _handler) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHandler(_handler);
    }

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMerkleRoot(_merkleRoot);
    }

    function ownerWithdrawRewardToken(address _token, address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerWithdrawRewardToken(_token, _receiver);
    }

    // ==============================================================
    // ======================= View Functions =======================
    // ==============================================================

    function addressRemapping(address _user) public view returns (address) {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        return s.addressRemapping[_user];
    }

    function getUserOrRemappedAddress(address _user) public view returns (address) {
        address remappedAddress = addressRemapping(_user);
        return remappedAddress == address(0) ? _user : remappedAddress;
    }

    function merkleRoot() public view returns (bytes32) {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        return s.merkleRoot;
    }

    function handler() public view returns (address) {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        return s.handler;
    }

    function claimEnabled() public view returns (bool) {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        return s.claimEnabled;
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetAddressRemapping(address[] memory _users, address[] memory _remappedAddresses) internal {
        BaseClaimStorage storage s = _getBaseClaimStorage();

        Require.that(
            _users.length == _remappedAddresses.length,
            _FILE,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < _users.length; i++) {
            s.addressRemapping[_users[i]] = _remappedAddresses[i];
        }
        emit AddressRemappingSet(_users, _remappedAddresses);
    }

    function _ownerSetClaimEnabled(bool _enabled) internal {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        s.claimEnabled = _enabled;
        emit ClaimEnabledSet(_enabled);
    }

    function _ownerSetHandler(address _handler) internal {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        Require.that(
            _handler != address(0),
            _FILE,
            "Invalid handler address"
        );

        s.handler = _handler;
        emit HandlerSet(_handler);
    }

    function _ownerSetMerkleRoot(bytes32 _merkleRoot) internal {
        BaseClaimStorage storage s = _getBaseClaimStorage();
        s.merkleRoot = _merkleRoot;
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
        return MerkleProof.verifyCalldata(_proof, merkleRoot(), leaf);
    }

    function _getBaseClaimStorage() internal pure returns (BaseClaimStorage storage baseClaimStorage) {
        bytes32 slot = _BASE_CLAIM_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            baseClaimStorage.slot := slot
        }
    }
}
