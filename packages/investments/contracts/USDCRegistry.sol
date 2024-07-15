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

import { BaseRegistry } from "@dolomite-exchange/modules-base/contracts/general/BaseRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IAaveLendingPool } from "./interfaces/IAaveLendingPool.sol";
import { IUSDCRegistry } from "./interfaces/IUSDCRegistry.sol";


/**
 * @title   USDCRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the USDC-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Arbitrum introduces.
 */
contract USDCRegistry is IUSDCRegistry, BaseRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "USDCRegistry";

    bytes32 private constant _AAVE_LENDING_POOL_SLOT = bytes32(uint256(keccak256("eip1967.proxy.aaveLendingPool")) - 1);

    // ==================== Initializer ====================

    function initialize(address _dolomiteRegistry) external initializer {
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    // ==================== Functions ====================

    function ownerSetAaveLendingPool(
        address _aaveLendingPool
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAaveLendingPool(_aaveLendingPool);
    }

    // ==================== Views ====================

    function aaveLendingPool() external view returns (IAaveLendingPool) {
        return IAaveLendingPool(_getAddress(_AAVE_LENDING_POOL_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetAaveLendingPool(address _aaveLendingPool) internal {
        Require.that(
            _aaveLendingPool != address(0),
            _FILE,
            "Invalid aaveLendingPool"
        );
        _setAddress(_AAVE_LENDING_POOL_SLOT, _aaveLendingPool);
        emit AaveLendingPoolSet(_aaveLendingPool);
    }
}
