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

import { IJonesGLPAdapter } from "./IJonesGLPAdapter.sol";
import { IJonesGLPVaultRouter } from "./IJonesGLPVaultRouter.sol";
import { IJonesWhitelistController } from "./IJonesWhitelistController.sol";
import { IERC4626 } from "../IERC4626.sol";


/**
 * @title   IJonesUSDCRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with Jones DAO's jUSDC token
 */
interface IJonesUSDCRegistry {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event GlpAdapterSet(address indexed _glpAdapter);
    event GlpVaultRouterSet(address indexed _glpVaultRouter);
    event WhitelistControllerSet(address indexed _whitelistController);
    event UsdcReceiptTokenSet(address indexed _usdcReceiptToken);
    event JUSDCSet(address indexed _jUSDC);
    event UnwrapperTraderSet(address indexed _unwrapperTrader);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function initializeUnwrapperTrader(address _unwrapperTrader) external;

    function ownerGlpAdapter(address _glpAdapter) external;

    function ownerSetGlpVaultRouter(address _glpVaultRouter) external;

    function ownerSetWhitelistController(address _whitelistController) external;

    function ownerSetUsdcReceiptToken(address _usdcReceiptToken) external;

    function ownerSetJUSDC(address _jUSDC) external;

    function ownerSetUnwrapperTrader(address _unwrapperTrader) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function glpAdapter() external view returns (IJonesGLPAdapter);

    function glpVaultRouter() external view returns (IJonesGLPVaultRouter);

    function whitelistController() external view returns (IJonesWhitelistController);

    function usdcReceiptToken() external view returns (IERC4626);

    function jUSDC() external view returns (IERC4626);

    function unwrapperTrader() external view returns (address);
}
