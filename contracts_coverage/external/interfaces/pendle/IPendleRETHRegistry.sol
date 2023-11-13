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
 * @title   IPendleRETHRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the Pendle ecosystem for wstETH
 *          (June 2024 & June 2025).
 */
interface IPendleRETHRegistry is IBaseRegistry {
    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event PendleRouterSet(address indexed _pendleRouter);
    event PtRETHMarketSet(address indexed _ptRETHMarket);
    event PtRETHTokenSet(address indexed _ptRETHToken);
    event PtOracleSet(address indexed _ptOracle);
    event SyRETHTokenSet(address indexed _syRETHToken);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetPendleRouter(address _pendleRouter) external;

    function ownerSetPtRETHMarket(address _ptRETHMarket) external;

    function ownerSetPtRETHToken(address _ptRETHToken) external;

    function ownerSetPtOracle(address _ptOracle) external;

    function ownerSetSyRETHToken(address _syRETHToken) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function pendleRouter() external view returns (IPendleRouter);

    function ptRETHMarket() external view returns (IPendlePtMarket);

    function ptRETHToken() external view returns (IPendlePtToken);

    function ptOracle() external view returns (IPendlePtOracle);

    function syRETHToken() external view returns (IPendleSyToken);
}
