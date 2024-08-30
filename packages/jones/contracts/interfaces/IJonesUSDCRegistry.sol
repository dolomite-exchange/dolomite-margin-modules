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

import { IBaseRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IBaseRegistry.sol";
import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { IJonesUSDCFarm } from "./IJonesUSDCFarm.sol";
import { IJonesUSDCRouter } from "./IJonesUSDCRouter.sol";
import { IJonesWhitelistControllerV2 } from "./IJonesWhitelistControllerV2.sol";


/**
 * @title   IJonesUSDCRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with Jones DAO's jUSDC token
 */
interface IJonesUSDCRegistry is IBaseRegistry {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event JUSDCRouterSet(address indexed _jusdcRouter);
    event WhitelistControllerSet(address indexed _whitelistController);
    event JUSDCSet(address indexed _jUSDC);
    event UnwrapperTraderForLiquidationSet(address indexed _unwrapperTraderForLiquidation);
    event UnwrapperTraderForZapSet(address indexed _unwrapperTraderForZap);
    event JUSDCFarmSet(address indexed _jUSDCFarm);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function initializeUnwrapperTraders(
        address _unwrapperTraderForLiquidation,
        address _unwrapperTraderForZap
    ) external;

    function ownerSetJUsdcRouter(address _jUsdcRouter) external;

    function ownerSetWhitelistController(address _whitelistController) external;

    function ownerSetJUSDC(address _jUSDC) external;

    function ownerSetUnwrapperTraderForLiquidation(address _unwrapperTraderForLiquidation) external;

    function ownerSetUnwrapperTraderForZap(address _unwrapperTraderForZap) external;

    function ownerSetJUSDCFarm(address _jUSDCFarm) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function jUSDCRouter() external view returns (IJonesUSDCRouter);

    function whitelistController() external view returns (IJonesWhitelistControllerV2);

    function jUSDC() external view returns (IERC4626);

    function unwrapperTraderForLiquidation() external view returns (address);

    function unwrapperTraderForZap() external view returns (address);

    function jUSDCFarm() external view returns (IJonesUSDCFarm);
}
