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
import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IJonesUSDCFarm } from "./interfaces/IJonesUSDCFarm.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";
import { IJonesUSDCRouter } from "./interfaces/IJonesUSDCRegistry.sol";
import { IJonesWhitelistControllerV2 } from "./interfaces/IJonesWhitelistControllerV2.sol";


/**
 * @title   JonesUSDCRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the JonesDAO-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that JonesDAO introduces.
 */
contract JonesUSDCRegistry is IJonesUSDCRegistry, BaseRegistry {

    // ==================== Constants ====================

    // solhint-disable max-line-length
    bytes32 private constant _FILE = "JonesUSDCRegistry";
    bytes32 private constant _JUSDC_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.jUSDCRouter")) - 1);
    bytes32 private constant _WHITELIST_CONTROLLER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.whitelistController")) - 1);
    bytes32 private constant _JUSDC_SLOT = bytes32(uint256(keccak256("eip1967.proxy.jUSDC")) - 1);
    bytes32 private constant _UNWRAPPER_TRADER_FOR_LIQUIDATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.unwrapperTraderForLiquidation")) - 1);
    bytes32 private constant _UNWRAPPER_TRADER_FOR_ZAP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.unwrapperTraderForZap")) - 1);
    bytes32 private constant _JUSDC_FARM_SLOT = bytes32(uint256(keccak256("eip1967.proxy.jUSDCFarm")) - 1);
    // solhint-enable max-line-length

    // ==================== Initializers ====================

    function initialize(
        address _jUSDCRouter,
        address _whitelistController,
        address _jUSDC,
        address _jonesUSDCFarm,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetJUsdcRouter(_jUSDCRouter);
        _ownerSetWhitelistController(_whitelistController);
        _ownerSetJUSDC(_jUSDC);
        _ownerSetJUSDCFarm(_jonesUSDCFarm);
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    function initializeUnwrapperTraders(
        address _unwrapperTraderForLiquidation,
        address _unwrapperTraderForZap
    ) external {
        Require.that(
            unwrapperTraderForLiquidation() == address(0) && unwrapperTraderForZap() == address(0),
            _FILE,
            "Already initialized"
        );
        _ownerSetUnwrapperTraderForLiquidation(_unwrapperTraderForLiquidation);
        _ownerSetUnwrapperTraderForZap(_unwrapperTraderForZap);
    }

    // ==================== Admin Methods ====================

    function ownerSetJUsdcRouter(
        address _jUsdcRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetJUsdcRouter(_jUsdcRouter);
    }

    function ownerSetWhitelistController(
        address _whitelistController
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetWhitelistController(_whitelistController);
    }

    function ownerSetJUSDC(
        address _jUSDC
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetJUSDC(_jUSDC);
    }

    function ownerSetUnwrapperTraderForLiquidation(
        address _unwrapperTraderForLiquidation
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetUnwrapperTraderForLiquidation(_unwrapperTraderForLiquidation);
    }

    function ownerSetUnwrapperTraderForZap(
        address _unwrapperTraderForZap
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetUnwrapperTraderForZap(_unwrapperTraderForZap);
    }

    function ownerSetJUSDCFarm(
        address _jUSDCFarm
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetJUSDCFarm(_jUSDCFarm);
    }

    // ==================== Public Methods ====================

    function jUSDCRouter() public view returns (IJonesUSDCRouter) {
        return IJonesUSDCRouter(_getAddress(_JUSDC_ROUTER_SLOT));
    }

    function whitelistController() public view returns (IJonesWhitelistControllerV2) {
        return IJonesWhitelistControllerV2(_getAddress(_WHITELIST_CONTROLLER_SLOT));
    }

    function jUSDC() public view returns (IERC4626) {
        return IERC4626(_getAddress(_JUSDC_SLOT));
    }

    function unwrapperTraderForLiquidation() public view returns (address) {
        return _getAddress(_UNWRAPPER_TRADER_FOR_LIQUIDATION_SLOT);
    }

    function unwrapperTraderForZap() public view returns (address) {
        return _getAddress(_UNWRAPPER_TRADER_FOR_ZAP_SLOT);
    }

    function jUSDCFarm() public view returns (IJonesUSDCFarm) {
        return IJonesUSDCFarm(_getAddress(_JUSDC_FARM_SLOT));
    }

    // ==================== Private Functions ====================

    function _ownerSetJUsdcRouter(address _jusdcRouter) internal {
        Require.that(
            _jusdcRouter != address(0),
            _FILE,
            "Invalid jusdcRouter address"
        );
        _setAddress(_JUSDC_ROUTER_SLOT, _jusdcRouter);
        emit JUSDCRouterSet(_jusdcRouter);
    }

    function _ownerSetWhitelistController(address _whitelistController) internal {
        Require.that(
            _whitelistController != address(0),
            _FILE,
            "Invalid whitelist address"
        );
        _setAddress(_WHITELIST_CONTROLLER_SLOT, _whitelistController);
        emit WhitelistControllerSet(_whitelistController);
    }

    function _ownerSetJUSDC(address _jUSDC) internal {
        Require.that(
            _jUSDC != address(0),
            _FILE,
            "Invalid jUSDC address"
        );
        _setAddress(_JUSDC_SLOT, _jUSDC);
        emit JUSDCSet(_jUSDC);
    }

    function _ownerSetUnwrapperTraderForLiquidation(address _unwrapperTraderForLiquidation) internal {
        Require.that(
            _unwrapperTraderForLiquidation != address(0),
            _FILE,
            "Invalid unwrapperTrader address"
        );
        _setAddress(_UNWRAPPER_TRADER_FOR_LIQUIDATION_SLOT, _unwrapperTraderForLiquidation);
        emit UnwrapperTraderForLiquidationSet(_unwrapperTraderForLiquidation);
    }

    function _ownerSetUnwrapperTraderForZap(address _unwrapperTraderForZap) internal {
        Require.that(
            _unwrapperTraderForZap != address(0),
            _FILE,
            "Invalid unwrapperTrader address"
        );
        _setAddress(_UNWRAPPER_TRADER_FOR_ZAP_SLOT, _unwrapperTraderForZap);
        emit UnwrapperTraderForZapSet(_unwrapperTraderForZap);
    }

    function _ownerSetJUSDCFarm(address _jUSDCFarm) internal {
        Require.that(
            _jUSDCFarm != address(0),
            _FILE,
            "Invalid jUSDCFarm address"
        );
        _setAddress(_JUSDC_FARM_SLOT, _jUSDCFarm);
        emit JUSDCFarmSet(_jUSDCFarm);
    }
}
