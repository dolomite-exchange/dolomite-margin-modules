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

import { IPendleRETHRegistry } from "../interfaces/pendle/IPendleRETHRegistry.sol";
import { IPendlePtMarket } from "../interfaces/pendle/IPendlePtMarket.sol";
import { IPendlePtOracle } from "../interfaces/pendle/IPendlePtOracle.sol";
import { IPendlePtToken } from "../interfaces/pendle/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/pendle/IPendleSyToken.sol";
import { IPendleYtToken } from "../interfaces/pendle/IPendleYtToken.sol";


/**
 * @title   PendleRETHRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Pendle-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Pendle introduces.
 */
contract PendleRETHRegistry is IPendleRETHRegistry, BaseRegistry {
    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendleRETHRegistry";

    bytes32 private constant _PENDLE_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.pendleRouter")) - 1);
    bytes32 private constant _PENDLE_PT_RETH_MARKET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.rETHMarket")) - 1);
    bytes32 private constant _PENDLE_PT_RETH_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.rETHToken")) - 1);
    bytes32 private constant _PENDLE_PT_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptOracle")) - 1);
    bytes32 private constant _PENDLE_SY_RETH_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.syRETHToken")) - 1);

    // ==================== Initializer ====================

    function initialize(
        address _pendleRouter,
        address _ptRETHMarket,
        address _ptRETHToken,
        address _ptOracle,
        address _syRETHToken,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetPendleRouter(_pendleRouter);
        _ownerSetPtRETHMarket(_ptRETHMarket);
        _ownerSetPtRETHToken(_ptRETHToken);
        _ownerSetPtOracle(_ptOracle);
        _ownerSetSyRETHToken(_syRETHToken);
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

    function ownerSetPtRETHMarket(
        address _ptRETHMarket
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtRETHMarket(_ptRETHMarket);
    }

    function ownerSetPtRETHToken(
        address _ptRETHToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtRETHToken(_ptRETHToken);
    }

    function ownerSetPtOracle(
        address _ptOracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtOracle(_ptOracle);
    }

    function ownerSetSyRETHToken(
        address _syRETHToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSyRETHToken(_syRETHToken);
    }

    // ==================== Views ====================

    function pendleRouter() external view returns (IPendleRouter) {
        return IPendleRouter(_getAddress(_PENDLE_ROUTER_SLOT));
    }

    function ptRETHMarket() external view returns (IPendlePtMarket) {
        return IPendlePtMarket(_getAddress(_PENDLE_PT_RETH_MARKET_SLOT));
    }

    function ptRETHToken() external view returns (IPendlePtToken) {
        return IPendlePtToken(_getAddress(_PENDLE_PT_RETH_TOKEN_SLOT));
    }

    function ptOracle() external view returns (IPendlePtOracle) {
        return IPendlePtOracle(_getAddress(_PENDLE_PT_ORACLE_SLOT));
    }

    function syRETHToken() external view returns (IPendleSyToken) {
        return IPendleSyToken(_getAddress(_PENDLE_SY_RETH_TOKEN_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetPendleRouter(address _pendleRouter) internal {
        if (_pendleRouter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        _setAddress(_PENDLE_ROUTER_SLOT, _pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }

    function _ownerSetPtRETHMarket(address _ptRETHMarket) internal {
        if (_ptRETHMarket != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptRETHMarket != address(0),
            _FILE,
            "Invalid ptRETHMarket address"
        );
        _setAddress(_PENDLE_PT_RETH_MARKET_SLOT, _ptRETHMarket);
        emit PtRETHMarketSet(_ptRETHMarket);
    }

    function _ownerSetPtRETHToken(address _ptRETHToken) internal {
        if (_ptRETHToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptRETHToken != address(0),
            _FILE,
            "Invalid ptRETHToken address"
        );
        _setAddress(_PENDLE_PT_RETH_TOKEN_SLOT, _ptRETHToken);
        emit PtRETHTokenSet(_ptRETHToken);
    }

    function _ownerSetPtOracle(address _ptOracle) internal {
        if (_ptOracle != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptOracle != address(0),
            _FILE,
            "Invalid ptOracle address"
        );
        _setAddress(_PENDLE_PT_ORACLE_SLOT, _ptOracle);
        emit PtOracleSet(_ptOracle);
    }

    function _ownerSetSyRETHToken(address _syRETHToken) internal {
        if (_syRETHToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_syRETHToken != address(0),
            _FILE,
            "Invalid syRETHToken address"
        );
        _setAddress(_PENDLE_SY_RETH_TOKEN_SLOT, _syRETHToken);
        emit SyRETHTokenSet(_syRETHToken);
    }
}
