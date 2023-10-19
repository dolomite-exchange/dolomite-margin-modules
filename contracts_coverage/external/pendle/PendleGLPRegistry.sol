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

import { IPendleGLPRegistry } from "../interfaces/pendle/IPendleGLPRegistry.sol";
import { IPendlePtMarket } from "../interfaces/pendle/IPendlePtMarket.sol";
import { IPendlePtOracle } from "../interfaces/pendle/IPendlePtOracle.sol";
import { IPendlePtToken } from "../interfaces/pendle/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/pendle/IPendleSyToken.sol";
import { IPendleYtToken } from "../interfaces/pendle/IPendleYtToken.sol";


/**
 * @title   PendleGLPRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Pendle-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Pendle introduces.
 */
contract PendleGLPRegistry is IPendleGLPRegistry, BaseRegistry {
    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendleGLPRegistry";

    bytes32 private constant _PENDLE_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.pendleRouter")) - 1);
    bytes32 private constant _PENDLE_PT_GLP_MARKET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptGlpMarket")) - 1);
    bytes32 private constant _PENDLE_PT_GLP_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptGlpToken")) - 1);
    bytes32 private constant _PENDLE_PT_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptOracle")) - 1);
    bytes32 private constant _PENDLE_SY_GLP_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.syGlpToken")) - 1);
    bytes32 private constant _PENDLE_YT_GLP_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ytGlpToken")) - 1);

    // ==================== Initializer ====================

    function initialize(
        address _pendleRouter,
        address _ptGlpMarket,
        address _ptGlpToken,
        address _ptOracle,
        address _syGlpToken,
        address _ytGlpToken,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetPendleRouter(_pendleRouter);
        _ownerSetPtGlpMarket(_ptGlpMarket);
        _ownerSetPtOracle(_ptOracle);
        _ownerSetSyGlpToken(_syGlpToken);
        _ownerSetPtGlpToken(_ptGlpToken);
        _ownerSetYtGlpToken(_ytGlpToken);
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

    function ownerSetPtGlpMarket(
        address _ptGlpMarket
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtGlpMarket(_ptGlpMarket);
    }

    function ownerSetPtOracle(
        address _ptOracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtOracle(_ptOracle);
    }

    function ownerSetSyGlpToken(
        address _syGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSyGlpToken(_syGlpToken);
    }

    function ownerSetPtGlpToken(
        address _ptGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtGlpToken(_ptGlpToken);
    }

    function ownerSetYtGlpToken(
        address _ytGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetYtGlpToken(_ytGlpToken);
    }

    // ==================== Views ====================

    function pendleRouter() external view returns (IPendleRouter) {
        return IPendleRouter(_getAddress(_PENDLE_ROUTER_SLOT));
    }

    function ptGlpMarket() external view returns (IPendlePtMarket) {
        return IPendlePtMarket(_getAddress(_PENDLE_PT_GLP_MARKET_SLOT));
    }

    function ptOracle() external view returns (IPendlePtOracle) {
        return IPendlePtOracle(_getAddress(_PENDLE_PT_ORACLE_SLOT));
    }

    function syGlpToken() external view returns (IPendleSyToken) {
        return IPendleSyToken(_getAddress(_PENDLE_SY_GLP_TOKEN_SLOT));
    }

    function ptGlpToken() external view returns (IPendlePtToken) {
        return IPendlePtToken(_getAddress(_PENDLE_PT_GLP_TOKEN_SLOT));
    }

    function ytGlpToken() external view returns (IPendleYtToken) {
        return IPendleYtToken(_getAddress(_PENDLE_YT_GLP_TOKEN_SLOT));
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

    function _ownerSetPtGlpMarket(address _ptGlpMarket) internal {
        if (_ptGlpMarket != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
_ptGlpMarket != address(0),
            _FILE,
            "Invalid ptGlpMarket address"
        );
        _setAddress(_PENDLE_PT_GLP_MARKET_SLOT, _ptGlpMarket);
        emit PtGlpMarketSet(_ptGlpMarket);
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

    function _ownerSetSyGlpToken(address _syGlpToken) internal {
        if (_syGlpToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
_syGlpToken != address(0),
            _FILE,
            "Invalid syGlpToken address"
        );
        _setAddress(_PENDLE_SY_GLP_TOKEN_SLOT, _syGlpToken);
        emit SyGlpTokenSet(_syGlpToken);
    }

    function _ownerSetPtGlpToken(address _ptGlpToken) internal {
        if (_ptGlpToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
_ptGlpToken != address(0),
            _FILE,
            "Invalid ptGlpToken address"
        );
        _setAddress(_PENDLE_PT_GLP_TOKEN_SLOT, _ptGlpToken);
        emit PtGlpTokenSet(_ptGlpToken);
    }

    function _ownerSetYtGlpToken(address _ytGlpToken) internal {
        if (_ytGlpToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
_ytGlpToken != address(0),
            _FILE,
            "Invalid ytGlpToken address"
        );
        _setAddress(_PENDLE_YT_GLP_TOKEN_SLOT, _ytGlpToken);
        emit YtGlpTokenSet(_ytGlpToken);
    }
}
