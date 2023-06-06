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

import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IPendlePtGLP2024Registry } from "../interfaces/IPendlePtGLP2024Registry.sol";
import { IPendlePtMarket } from "../interfaces/IPendlePtMarket.sol";
import { IPendlePtOracle } from "../interfaces/IPendlePtOracle.sol";
import { IPendlePtToken } from "../interfaces/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/IPendleSyToken.sol";


/**
 * @title   PendlePtGLP2024Registry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the PlutusDAO-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that PlutusDAO introduces.
 */
contract PendlePtGLP2024Registry is IPendlePtGLP2024Registry, OnlyDolomiteMargin {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendlePtGLP2024Registry";

    // ==================== Storage ====================

    IPendleRouter public override pendleRouter;
    IPendlePtMarket public override ptGlpMarket;
    IPendlePtToken public override ptGlpToken;
    IPendlePtOracle public override ptOracle;
    IPendleSyToken public override syGlpToken;

    // ==================== Constructor ====================

    constructor(
        address _pendleRouter,
        address _ptGlpMarket,
        address _ptGlpToken,
        address _ptOracle,
        address _syGlpToken,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        pendleRouter = IPendleRouter(_pendleRouter);
        ptGlpMarket = IPendlePtMarket(_ptGlpMarket);
        ptGlpToken = IPendlePtToken(_ptGlpToken);
        ptOracle = IPendlePtOracle(_ptOracle);
        syGlpToken = IPendleSyToken(_syGlpToken);
    }

    function ownerSetPendleRouter(
        address _pendleRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_pendleRouter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        pendleRouter = IPendleRouter(_pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }

    function ownerSetPtGlpMarket(
        address _ptGlpMarket
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_ptGlpMarket != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptGlpMarket != address(0),
            _FILE,
            "Invalid ptGlpMarket address"
        );
        ptGlpMarket = IPendlePtMarket(_ptGlpMarket);
        emit PtGlpMarketSet(_ptGlpMarket);
    }

    function ownerSetPtGlpToken(
        address _ptGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_ptGlpToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptGlpToken != address(0),
            _FILE,
            "Invalid ptGlpToken address"
        );
        ptGlpToken = IPendlePtToken(_ptGlpToken);
        emit PtGlpTokenSet(_ptGlpToken);
    }

    function ownerSetPtOracle(
        address _ptOracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_ptOracle != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptOracle != address(0),
            _FILE,
            "Invalid ptOracle address"
        );
        ptOracle = IPendlePtOracle(_ptOracle);
        emit PtOracleSet(_ptOracle);
    }

    function ownerSetSyGlpToken(
        address _syGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        if (_syGlpToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_syGlpToken != address(0),
            _FILE,
            "Invalid syGlpToken address"
        );
        syGlpToken = IPendleSyToken(_syGlpToken);
        emit SyGlpTokenSet(_syGlpToken);
    }
}
