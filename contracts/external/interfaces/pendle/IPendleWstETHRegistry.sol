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
import { IBaseRegistry } from "../IBaseRegistry.sol";


/**
 * @title   IPendleWstETHRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the Pendle ecosystem for wstETH
 *          (June 2024 & June 2025).
 */
interface IPendleWstETHRegistry is IBaseRegistry {
    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event PendleRouterSet(address indexed _pendleRouter);
    event PtWstEth2024MarketSet(address indexed _ptWstEth2024Market);
    event PtWstEth2024TokenSet(address indexed _ptWstEth2024Token);
    event PtWstEth2025MarketSet(address indexed _ptWstEth2025Market);
    event PtWstEth2025TokenSet(address indexed _ptWstEth2025Token);
    event PtOracleSet(address indexed _ptOracle);
    event SyWstEthTokenSet(address indexed _syWstEthToken);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetPendleRouter(address _pendleRouter) external;

    function ownerSetPtWstEth2024Market(address _ptWstEth2024Market) external;

    function ownerSetPtWstEth2024Token(address _ptWstEth2024Token) external;

    function ownerSetPtWstEth2025Market(address _ptWstEth2025Market) external;

    function ownerSetPtWstEth2025Token(address _ptWstEth2025Token) external;

    function ownerSetPtOracle(address _ptOracle) external;

    function ownerSetSyWstEthToken(address _syWstEthToken) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function pendleRouter() external view returns (IPendleRouter);

    function ptWstEth2024Market() external view returns (IPendlePtMarket);

    function ptWstEth2024Token() external view returns (IPendlePtToken);

    function ptWstEth2025Token() external view returns (IPendlePtToken);

    function ptOracle() external view returns (IPendlePtOracle);

    function syWstEthToken() external view returns (IPendleSyToken);
}
