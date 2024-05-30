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
import { IDeltaSwapRouter } from "./interfaces/IDeltaSwapRouter.sol";
import { IGammaPositionManager } from "./interfaces/IGammaPositionManager.sol";
import { IGammaRegistry } from "./interfaces/IGammaRegistry.sol";


/**
 * @title   GammaRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Gamma-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Gamma introduces.
 */
contract GammaRegistry is IGammaRegistry, BaseRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "GammaRegistry";

    bytes32 private constant _GAMMA_POSITION_MANAGER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gammaPositionManager")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _DELTA_SWAP_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.deltaSwapRouter")) - 1); // solhint-disable-line max-line-length

    // ==================== Initializer ====================

    function initialize(
        address _gammaPositionManager,
        address _deltaSwapRouter,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
        _ownerSetGammaPositionManager(_gammaPositionManager);
        _ownerSetDeltaSwapRouter(_deltaSwapRouter);
    }

    // ==================== Functions ====================

    function ownerSetGammaPositionManager(
        address _gammaPositionManager
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGammaPositionManager(_gammaPositionManager);
    }

    function ownerSetDeltaSwapRouter(
        address _deltaSwapRouter
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDeltaSwapRouter(_deltaSwapRouter);
    }

    // ==================== Views ====================

    function gammaPositionManager() external view override returns (IGammaPositionManager) {
        return IGammaPositionManager(_getAddress(_GAMMA_POSITION_MANAGER_SLOT));
    }

    function deltaSwapRouter() external view override returns (IDeltaSwapRouter) {
        return IDeltaSwapRouter(_getAddress(_DELTA_SWAP_ROUTER_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetGammaPositionManager(address _gammaPositionManager) internal {
        Require.that(
            _gammaPositionManager != address(0),
            _FILE,
            "Invalid gammaPositionManager"
        );
        _setAddress(_GAMMA_POSITION_MANAGER_SLOT, _gammaPositionManager);
        emit GammaPositionManagerSet(_gammaPositionManager);
    }

    function _ownerSetDeltaSwapRouter(address _deltaSwapRouter) internal {
        Require.that(
            _deltaSwapRouter != address(0),
            _FILE,
            "Invalid deltaSwapRouter"
        );
        _setAddress(_DELTA_SWAP_ROUTER_SLOT, _deltaSwapRouter);
        emit DeltaSwapRouterSet(_deltaSwapRouter);
    }
}
