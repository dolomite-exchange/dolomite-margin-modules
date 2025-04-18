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


/**
 * @title   IBaseClaim
 * @author  Dolomite
 *
 * @notice  Interface for base claim contract
 */
interface IBaseClaim {

    struct BaseClaimStorage {
        bytes32 merkleRoot;
        mapping(address => address) addressRemapping;
        address handler;
        bool claimEnabled;
    }

    // ======================================================
    // ======================== Events ======================
    // ======================================================

    event AddressRemappingSet(address[] users, address[] remappedAddresses);
    event AddressRemappingCleared(address user);
    event ClaimEnabledSet(bool claimEnabled);
    event HandlerSet(address handler);
    event MerkleRootSet(bytes32 merkleRoot);

    // ======================================================
    // ================== External Functions ================
    // ======================================================

    function ownerSetAddressRemapping(address[] memory _users, address[] memory _remappedAddresses) external;

    function ownerSetClaimEnabled(bool _enabled) external;

    function ownerSetHandler(address _handler) external;

    function ownerSetMerkleRoot(bytes32 _merkleRoot) external;

    function ownerWithdrawRewardToken(address _token, address _receiver) external;

    // ======================================================
    // ==================== View Functions ==================
    // ======================================================

    function addressRemapping(address _user) external view returns (address);

    function claimEnabled() external view returns (bool);

    function getUserOrRemappedAddress(address _user) external view returns (address);

    function merkleRoot() external view returns (bytes32);

    function handler() external view returns (address);
}
