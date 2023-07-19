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

import { Require } from "../../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../../helpers/OnlyDolomiteMargin.sol";
import { IERC4626 } from "../../interfaces/IERC4626.sol";
import { IJonesGLPAdapter } from "../../interfaces/jones/IJonesGLPAdapter.sol";
import { IJonesGLPVaultRouter } from "../../interfaces/jones/IJonesGLPVaultRouter.sol";
import { IJonesUSDCRegistry } from "../../interfaces/jones/IJonesUSDCRegistry.sol";
import { IJonesWhitelistController } from "../../interfaces/jones/IJonesWhitelistController.sol";


/**
 * @title   JonesUSDCRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the JonesDAO-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that JonesDAO introduces.
 */
contract JonesUSDCRegistry is IJonesUSDCRegistry, OnlyDolomiteMargin {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "JonesUSDCRegistry";
    bytes32 private constant _GLP_ADAPTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glpAdapter")) - 1);
    bytes32 private constant _GLP_VAULT_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glpVaultRouter")) - 1);
    bytes32 private constant _WHITELIST_CONTROLLER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.whitelistController")) - 1);
    bytes32 private constant _USDC_RECEIPT_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.usdcReceiptToken")) - 1);
    bytes32 private constant _JUSDC_SLOT = bytes32(uint256(keccak256("eip1967.proxy.jUSDC")) - 1);
    bytes32 private constant _UNWRAPPER_TRADER_FOR_LIQUIDATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.unwrapperTraderForLiquidation")) - 1);
    bytes32 private constant _UNWRAPPER_TRADER_FOR_ZAP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.unwrapperTraderForZap")) - 1);

    // ==================== Constructor ====================

    constructor(
        address _glpAdapter,
        address _glpVaultRouter,
        address _whitelistController,
        address _usdcReceiptToken,
        address _jUSDC,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        glpAdapter = IJonesGLPAdapter(_glpAdapter);
        glpVaultRouter = IJonesGLPVaultRouter(_glpVaultRouter);
        whitelistController = IJonesWhitelistController(_whitelistController);
        usdcReceiptToken = IERC4626(_usdcReceiptToken);
        jUSDC = IERC4626(_jUSDC);
    }

    function initializeUnwrapperTraders(
        address _unwrapperTraderForLiquidation,
        address _unwrapperTraderForZap
    ) external {
        Require.that(
            unwrapperTraderForLiquidation == address(0) && unwrapperTraderForZap == address(0),
            _FILE,
            "Already initialized"
        );
        _setUnwrapperTraderForLiquidation(_unwrapperTraderForLiquidation);
        _setUnwrapperTraderForZap(_unwrapperTraderForZap);
    }

    function ownerGlpAdapter(
        address _glpAdapter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _glpAdapter != address(0),
            _FILE,
            "Invalid glpAdapter address"
        );
        glpAdapter = IJonesGLPAdapter(_glpAdapter);
        emit GlpAdapterSet(_glpAdapter);
    }

    function ownerSetGlpVaultRouter(
        address _glpVaultRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _glpVaultRouter != address(0),
            _FILE,
            "Invalid glpVaultRouter address"
        );
        glpVaultRouter = IJonesGLPVaultRouter(_glpVaultRouter);
        emit GlpVaultRouterSet(_glpVaultRouter);
    }

    function ownerSetWhitelistController(
        address _whitelistController
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _whitelistController != address(0),
            _FILE,
            "Invalid whitelist address"
        );
        whitelistController = IJonesWhitelistController(_whitelistController);
        emit WhitelistControllerSet(_whitelistController);
    }

    function ownerSetUsdcReceiptToken(
        address _usdcReceiptToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _usdcReceiptToken != address(0),
            _FILE,
            "Invalid usdcReceiptToken address"
        );
        usdcReceiptToken = IERC4626(_usdcReceiptToken);
        emit UsdcReceiptTokenSet(_usdcReceiptToken);
    }

    function ownerSetJUSDC(
        address _jUSDC
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _jUSDC != address(0),
            _FILE,
            "Invalid jUSDC address"
        );
        jUSDC = IERC4626(_jUSDC);
        emit JUSDCSet(_jUSDC);
    }

    function ownerSetUnwrapperTraderForLiquidation(
        address _unwrapperTraderForLiquidation
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _setUnwrapperTraderForLiquidation(_unwrapperTraderForLiquidation);
    }

    function ownerSetUnwrapperTraderForZap(
        address _unwrapperTraderForZap
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _setUnwrapperTraderForZap(_unwrapperTraderForZap);
    }

    function glpAdapter() public view returns (IJonesGLPAdapter) {
        return IJonesGLPAdapter(_getAddress(_GLP_ADAPTER_SLOT));
    }

    function glpVaultRouter() public view returns (IJonesGLPVaultRouter) {
        return IJonesGLPVaultRouter(_getAddress(_GLP_VAULT_ROUTER_SLOT));
    }

    function whitelistController() public view returns (IJonesWhitelistController) {
        return IJonesWhitelistController(_getAddress(_WHITELIST_CONTROLLER_SLOT));
    }

    function usdcReceiptToken() public view returns (IERC4626) {
        return IERC4626(_getAddress(_USDC_RECEIPT_TOKEN_SLOT));
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

    // ==================== Private Functions ====================

    function _setUnwrapperTraderForLiquidation(address _unwrapperTraderForLiquidation) internal {
        Require.that(
            _unwrapperTraderForLiquidation != address(0),
            _FILE,
            "Invalid unwrapperTrader address"
        );
        unwrapperTraderForLiquidation = _unwrapperTraderForLiquidation;
        emit UnwrapperTraderForLiquidationSet(_unwrapperTraderForLiquidation);
    }

    function _setUnwrapperTraderForZap(address _unwrapperTraderForZap) internal {
        Require.that(
            _unwrapperTraderForZap != address(0),
            _FILE,
            "Invalid unwrapperTrader address"
        );
        unwrapperTraderForZap = _unwrapperTraderForZap;
        emit UnwrapperTraderForZapSet(_unwrapperTraderForZap);
    }
}
