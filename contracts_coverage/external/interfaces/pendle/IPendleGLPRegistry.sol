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

import { IPendlePtMarket } from "./IPendlePtMarket.sol";
import { IPendlePtOracle } from "./IPendlePtOracle.sol";
import { IPendlePtToken } from "./IPendlePtToken.sol";
import { IPendleRouter } from "./IPendleRouter.sol";
import { IPendleSyToken } from "./IPendleSyToken.sol";
import { IPendleYtToken } from "./IPendleYtToken.sol";
import { IBaseRegistry } from "../IBaseRegistry.sol";


/**
 * @title   IPendleGLPRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the Pendle ecosystem for GLP
 *          (March 2024).
 */
interface IPendleGLPRegistry is IBaseRegistry {
    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event PendleRouterSet(address indexed _pendleRouter);
    event PtGlpMarketSet(address indexed _ptGlpMarket);
    event PtGlpTokenSet(address indexed _ptGlpToken);
    event PtOracleSet(address indexed _ptOracle);
    event SyGlpTokenSet(address indexed _syGlpToken);
    event YtGlpTokenSet(address indexed _ytGlpToken);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetPendleRouter(address _pendleRouter) external;

    function ownerSetPtGlpMarket(address _ptGlpMarket) external;

    function ownerSetPtGlpToken(address _ptGlpToken) external;

    function ownerSetPtOracle(address _ptOracle) external;

    function ownerSetSyGlpToken(address _syGlpToken) external;

    function ownerSetYtGlpToken(address _ytGlpToken) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function pendleRouter() external view returns (IPendleRouter);

    function ptGlpMarket() external view returns (IPendlePtMarket);

    function ptGlpToken() external view returns (IPendlePtToken);

    function ptOracle() external view returns (IPendlePtOracle);

    function syGlpToken() external view returns (IPendleSyToken);

    function ytGlpToken() external view returns (IPendleYtToken);
}
