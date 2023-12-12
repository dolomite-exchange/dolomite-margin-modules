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
import { BaseRegistry } from "../general/BaseRegistry.sol";
import { IPendlePtMarket } from "../interfaces/pendle/IPendlePtMarket.sol";
import { IPendlePtOracle } from "../interfaces/pendle/IPendlePtOracle.sol";
import { IPendleRegistry } from "../interfaces/pendle/IPendleRegistry.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/pendle/IPendleSyToken.sol";


/**
 * @title   PendleRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Pendle-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Pendle introduces.
 */
contract PendleRegistry is IPendleRegistry, BaseRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendleRegistry";

    bytes32 private constant _PENDLE_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.pendleRouter")) - 1);
    bytes32 private constant _PENDLE_PT_MARKET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptMarket")) - 1);
    bytes32 private constant _PENDLE_PT_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptOracle")) - 1);
    bytes32 private constant _PENDLE_SY_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.syToken")) - 1);

    // ==================== Initializer ====================

    function initialize(
        address _pendleRouter,
        address _ptMarket,
        address _ptOracle,
        address _syToken,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetPendleRouter(_pendleRouter);
        _ownerSetPtMarket(_ptMarket);
        _ownerSetPtOracle(_ptOracle);
        _ownerSetSyToken(_syToken);
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    // ==================== Functions ====================

    function ownerSetPendleRouter(
        address _pendleRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPendleRouter(_pendleRouter);
    }

    function ownerSetPtMarket(
        address _ptMarket
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtMarket(_ptMarket);
    }

    function ownerSetPtOracle(
        address _ptOracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtOracle(_ptOracle);
    }

    function ownerSetSyToken(
        address _syToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSyToken(_syToken);
    }

    // ==================== Views ====================

    function pendleRouter() external view returns (IPendleRouter) {
        return IPendleRouter(_getAddress(_PENDLE_ROUTER_SLOT));
    }

    function ptMarket() external view returns (IPendlePtMarket) {
        return IPendlePtMarket(_getAddress(_PENDLE_PT_MARKET_SLOT));
    }

    function ptOracle() external view returns (IPendlePtOracle) {
        return IPendlePtOracle(_getAddress(_PENDLE_PT_ORACLE_SLOT));
    }

    function syToken() external view returns (IPendleSyToken) {
        return IPendleSyToken(_getAddress(_PENDLE_SY_TOKEN_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetPendleRouter(address _pendleRouter) internal {
        if (_pendleRouter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        _setAddress(_PENDLE_ROUTER_SLOT, _pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }

    function _ownerSetPtMarket(address _ptMarket) internal {
        if (_ptMarket != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _ptMarket != address(0),
            _FILE,
            "Invalid ptMarket address"
        );
        _setAddress(_PENDLE_PT_MARKET_SLOT, _ptMarket);
        emit PtMarketSet(_ptMarket);
    }

    function _ownerSetPtOracle(address _ptOracle) internal {
        if (_ptOracle != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _ptOracle != address(0),
            _FILE,
            "Invalid ptOracle address"
        );
        _setAddress(_PENDLE_PT_ORACLE_SLOT, _ptOracle);
        emit PtOracleSet(_ptOracle);
    }

    function _ownerSetSyToken(address _syToken) internal {
        if (_syToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _syToken != address(0),
            _FILE,
            "Invalid syToken address"
        );
        _setAddress(_PENDLE_SY_TOKEN_SLOT, _syToken);
        emit SyTokenSet(_syToken);
    }
}
