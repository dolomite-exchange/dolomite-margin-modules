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

import {Require} from "../../protocol/lib/Require.sol";

import {OnlyDolomiteMargin} from "../helpers/OnlyDolomiteMargin.sol";

import {IPendleGLPRegistry} from "../interfaces/pendle/IPendleGLPRegistry.sol";
import {IPendlePtMarket} from "../interfaces/pendle/IPendlePtMarket.sol";
import {IPendlePtOracle} from "../interfaces/pendle/IPendlePtOracle.sol";
import {IPendlePtToken} from "../interfaces/pendle/IPendlePtToken.sol";
import {IPendleYtToken} from "../interfaces/pendle/IPendleYtToken.sol";
import {IPendleRouter} from "../interfaces/pendle/IPendleRouter.sol";
import {IPendleSyToken} from "../interfaces/pendle/IPendleSyToken.sol";

/**
 * @title   PendleGLPRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Pendle-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Pendle introduces.
 */
contract PendleGLPRegistry is IPendleGLPRegistry, OnlyDolomiteMargin {
    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendleGLPRegistry";

    // ==================== Storage ====================

    IPendleRouter public override pendleRouter;
    IPendlePtMarket public override ptGlpMarket;
    IPendlePtToken public override ptGlpToken;
    IPendlePtOracle public override ptOracle;
    IPendleSyToken public override syGlpToken;
    IPendleYtToken public override ytGlpToken;

    // ==================== Constructor ====================

    constructor(
        address _pendleRouter,
        address _ptGlpMarket,
        address _ptGlpToken,
        address _ptOracle,
        address _syGlpToken,
        address _ytGlpToken,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        pendleRouter = IPendleRouter(_pendleRouter);
        ptGlpMarket = IPendlePtMarket(_ptGlpMarket);
        ptGlpToken = IPendlePtToken(_ptGlpToken);
        ptOracle = IPendlePtOracle(_ptOracle);
        syGlpToken = IPendleSyToken(_syGlpToken);
        ytGlpToken = IPendleYtToken(_ytGlpToken);
    }

    function ownerSetPendleRouter(
        address _pendleRouter
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        pendleRouter = IPendleRouter(_pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }

    function ownerSetPtGlpMarket(
        address _ptGlpMarket
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _ptGlpMarket != address(0),
            _FILE,
            "Invalid ptGlpMarket address"
        );
        ptGlpMarket = IPendlePtMarket(_ptGlpMarket);
        emit PtGlpMarketSet(_ptGlpMarket);
    }

    function ownerSetPtGlpToken(
        address _ptGlpToken
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _ptGlpToken != address(0),
            _FILE,
            "Invalid ptGlpToken address"
        );
        ptGlpToken = IPendlePtToken(_ptGlpToken);
        emit PtGlpTokenSet(_ptGlpToken);
    }

    function ownerSetPtOracle(
        address _ptOracle
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _ptOracle != address(0),
            _FILE,
            "Invalid ptOracle address"
        );
        ptOracle = IPendlePtOracle(_ptOracle);
        emit PtOracleSet(_ptOracle);
    }

    function ownerSetSyGlpToken(
        address _syGlpToken
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _syGlpToken != address(0),
            _FILE,
            "Invalid syGlpToken address"
        );
        syGlpToken = IPendleSyToken(_syGlpToken);
        emit SyGlpTokenSet(_syGlpToken);
    }

    function ownerSetYtGlpToken(
        address _ytGlpToken
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _ytGlpToken != address(0),
            _FILE,
            "Invalid ytGlpToken address"
        );
        ytGlpToken = IPendleYtToken(_ytGlpToken);
        emit YtGlpTokenSet(_ytGlpToken);
    }
}
