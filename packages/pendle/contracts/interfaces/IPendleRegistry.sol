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
import { IPendlePtMarket } from "./IPendlePtMarket.sol";
import { IPendlePtOracle } from "./IPendlePtOracle.sol";
import { IPendleRouter } from "./IPendleRouter.sol";
import { IPendleSyToken } from "./IPendleSyToken.sol";


/**
 * @title   IPendleRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the Pendle ecosystem for a PT
 *          asset.
 */
interface IPendleRegistry is IBaseRegistry {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event PendleRouterSet(address indexed _pendleRouter);
    event PtMarketSet(address indexed _ptMarket);
    event PtOracleSet(address indexed _ptOracle);
    event SyTokenSet(address indexed _syToken);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetPendleRouter(address _pendleRouter) external;

    function ownerSetPtMarket(address _ptMarket) external;

    function ownerSetPtOracle(address _ptOracle) external;

    function ownerSetSyToken(address _syToken) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function pendleRouter() external view returns (IPendleRouter);

    function ptMarket() external view returns (IPendlePtMarket);

    function ptOracle() external view returns (IPendlePtOracle);

    function syToken() external view returns (IPendleSyToken);
}
