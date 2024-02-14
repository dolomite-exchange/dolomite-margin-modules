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

import { ProxyContractHelpers } from "./ProxyContractHelpers.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   ReentrancyGuardUpgradeable
 * @author  Dolomite
 *
 * @notice  An upgradeable version of OpenZeppelin's ReentrancyGuard contract
 */
abstract contract ReentrancyGuardUpgradeable is ProxyContractHelpers {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "ReentrancyGuardUpgradeable";
    bytes32 private constant _REENTRANCY_GUARD_SLOT = bytes32(uint256(keccak256("eip1967.proxy.reentrancyGuard")) - 1);

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly. Calling a `nonReentrant` function from
     *      another `nonReentrant` function is not supported. It is possible to prevent this from happening by making
     *      the `nonReentrant` function external, and making it call a `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function __ReentrancyGuardUpgradeable__init() internal {
        _setUint256(_REENTRANCY_GUARD_SLOT, _NOT_ENTERED);
    }

    // ===================================================
    // ================ Private Functions ================
    // ===================================================

    function _nonReentrantBefore() private {
        // @audit:  This MUST stay as `value != _ENTERED` otherwise it will DOS old vaults that don't have the
        //          `initialize` fix
        if (_getUint256(_REENTRANCY_GUARD_SLOT) != _ENTERED) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _getUint256(_REENTRANCY_GUARD_SLOT) != _ENTERED,
            _FILE,
            "Reentrant call"
        );

        // Any calls to nonReentrant after this point will fail
        _setUint256(_REENTRANCY_GUARD_SLOT, _ENTERED);
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200)
        _setUint256(_REENTRANCY_GUARD_SLOT, _NOT_ENTERED);
    }
}
