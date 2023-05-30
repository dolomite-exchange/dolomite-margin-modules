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

import { IPendlePtMarket } from "../interfaces/IPendlePtMarket.sol";
import { IPendlePtToken } from "../interfaces/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/IPendleSyToken.sol";


/**
 * @title   IPendleGLP2024Registry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the Pendle ecosystem for GLP
 *          (March 2024).
 */
interface IPendleGLP2024Registry {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event PtGlpTokenSet(address indexed _ptGlpToken);
    event SyGlpTokenSet(address indexed _syGlpToken);
    event PtGlpMarketSet(address indexed _ptGlpMarket);
    event PendleRouterSet(address indexed _pendleRouter);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetPtGlpToken(address _ptGlpToken) external;

    function ownerSetSyGlpToken(address _syGlpToken) external;

    function ownerSetPtGlpMarket(address _ptGlpMarket) external;

    function ownerSetPendleRouter(address _pendleRouter) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function ptGlpToken() external view returns (IPendlePtToken);

    function syGlpToken() external view returns (IPendleSyToken);

    function ptGlpMarket() external view returns (IPendlePtMarket);

    function pendleRouter() external view returns (IPendleRouter);
}
