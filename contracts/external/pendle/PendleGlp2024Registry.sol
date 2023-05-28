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

import { IPendleGlp2024Registry } from "../interfaces/IPendleGlp2024Registry.sol";
import { IPendlePtMarket } from "../interfaces/IPendlePtMarket.sol";
import { IPendlePtToken } from "../interfaces/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/IPendleSyToken.sol";


/**
 * @title   PendleGlp2024Registry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the PlutusDAO-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that PlutusDAO introduces.
 */
contract PendleGlp2024Registry is IPendleGlp2024Registry, OnlyDolomiteMargin {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendleGlp2024Registry";

    // ==================== Storage ====================

    IPendlePtToken public override ptGlpToken;
    IPendleSyToken public override syGlpToken;
    IPendlePtMarket public override ptGlpMarket;
    IPendleRouter public override pendleRouter;

    // ==================== Constructor ====================

    constructor(
        address _ptGlpToken,
        address _syGlpToken,
        address _ptGlpMarket,
        address _pendleRouter,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        ptGlpToken = IPendlePtToken(_ptGlpToken);
        syGlpToken = IPendleSyToken(_syGlpToken);
        ptGlpMarket = IPendlePtMarket(_ptGlpMarket);
        pendleRouter = IPendleRouter(_pendleRouter);
    }

    function ownerSetPtGlpToken(
        address _ptGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _ptGlpToken != address(0),
            _FILE,
            "Invalid ptGlpToken address"
        );
        ptGlpToken = IPendlePtToken(_ptGlpToken);
        emit PtGlpTokenSet(_ptGlpToken);
    }

    function ownerSetSyGlpToken(
        address _syGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _syGlpToken != address(0),
            _FILE,
            "Invalid syGlpToken address"
        );
        syGlpToken = IPendleSyToken(_syGlpToken);
        emit SyGlpTokenSet(_syGlpToken);
    }

    function ownerSetPtGlpMarket(
        address _ptGlpMarket
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _ptGlpMarket != address(0),
            _FILE,
            "Invalid ptGlpMarket address"
        );
        ptGlpMarket = IPendlePtMarket(_ptGlpMarket);
        emit PtGlpMarketSet(_ptGlpMarket);
    }

    function ownerSetPendleRouter(
        address _pendleRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        pendleRouter = IPendleRouter(_pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }
}
