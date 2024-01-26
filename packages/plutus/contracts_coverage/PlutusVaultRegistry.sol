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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { BaseRegistry } from "@dolomite-exchange/modules-base/contracts/general/BaseRegistry.sol";
import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { IPlutusVaultGLPFarm } from "./interfaces/IPlutusVaultGLPFarm.sol";
import { IPlutusVaultGLPRouter } from "./interfaces/IPlutusVaultGLPRouter.sol";
import { IPlutusVaultRegistry } from "./interfaces/IPlutusVaultRegistry.sol";


/**
 * @title   PlutusVaultRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the PlutusDAO-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that PlutusDAO introduces.
 */
contract PlutusVaultRegistry is IPlutusVaultRegistry, BaseRegistry {

    // ==================== Constants ====================

    // solhint-disable max-line-length
    bytes32 private constant _FILE = "PlutusVaultRegistry";
    bytes32 private constant _PLUTUS_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.plutusToken")) - 1);
    bytes32 private constant _PLV_GLP_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.plvGlpToken")) - 1);
    bytes32 private constant _PLV_GLP_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.plvGlpRouter")) - 1);
    bytes32 private constant _PLV_GLP_FARM_SLOT = bytes32(uint256(keccak256("eip1967.proxy.plvGlpFarm")) - 1);

    // ==================== Initializer ====================

    function initialize(
        address _plutusToken,
        address _plvGlpToken,
        address _plvGlpRouter,
        address _plvGlpFarm,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetPlutusToken(_plutusToken);
        _ownerSetPlvGlpToken(_plvGlpToken);
        _ownerSetPlvGlpRouter(_plvGlpRouter);
        _ownerSetPlvGlpFarm(_plvGlpFarm);
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    // ==================== Admin Functions ====================

    function ownerSetPlutusToken(
        address _plutusToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPlutusToken(_plutusToken);
    }

    function ownerSetPlvGlpToken(
        address _plvGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPlvGlpToken(_plvGlpToken);
    }

    function ownerSetPlvGlpRouter(
        address _plvGlpRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPlvGlpRouter(_plvGlpRouter);
    }

    function ownerSetPlvGlpFarm(
        address _plvGlpFarm
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPlvGlpFarm(_plvGlpFarm);
    }

    // ===================== Public Functions =====================

    function plutusToken() public view returns (IERC20) {
        return IERC20(_getAddress(_PLUTUS_TOKEN_SLOT));
    }

    function plvGlpToken() public view returns (IERC4626) {
        return IERC4626(_getAddress(_PLV_GLP_TOKEN_SLOT));
    }

    function plvGlpRouter() public view returns (IPlutusVaultGLPRouter) {
        return IPlutusVaultGLPRouter(_getAddress(_PLV_GLP_ROUTER_SLOT));
    }

    function plvGlpFarm() public view returns (IPlutusVaultGLPFarm) {
        return IPlutusVaultGLPFarm(_getAddress(_PLV_GLP_FARM_SLOT));
    }

    // ==================== Internal Functions ====================

    function _ownerSetPlutusToken(address _plutusToken) internal {
        Require.that(
            _plutusToken != address(0),
            _FILE,
            "Invalid plutusToken address"
        );
        _setAddress(_PLUTUS_TOKEN_SLOT, _plutusToken);
        emit PlutusTokenSet(_plutusToken);
    }

    function _ownerSetPlvGlpToken(address _plvGlpToken) internal {
        Require.that(
            _plvGlpToken != address(0),
            _FILE,
            "Invalid plvGlpToken address"
        );
        _setAddress(_PLV_GLP_TOKEN_SLOT, _plvGlpToken);
        emit PlvGlpTokenSet(_plvGlpToken);
    }

    function _ownerSetPlvGlpRouter(address _plvGlpRouter) internal {
        Require.that(
            _plvGlpRouter != address(0),
            _FILE,
            "Invalid plvGlpRouter address"
        );
        _setAddress(_PLV_GLP_ROUTER_SLOT, _plvGlpRouter);
        emit PlvGlpRouterSet(_plvGlpRouter);
    }

    function _ownerSetPlvGlpFarm(address _plvGlpFarm) internal {
        Require.that(
            _plvGlpFarm != address(0),
            _FILE,
            "Invalid plvGlpFarm address"
        );
        _setAddress(_PLV_GLP_FARM_SLOT, _plvGlpFarm);
        emit PlvGlpFarmSet(_plvGlpFarm);
    }
}
