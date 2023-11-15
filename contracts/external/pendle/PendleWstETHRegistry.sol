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
import { IPendlePtToken } from "../interfaces/pendle/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/pendle/IPendleSyToken.sol";
import { IPendleWstETHRegistry } from "../interfaces/pendle/IPendleWstETHRegistry.sol";


/**
 * @title   PendleWstETHRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Pendle-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Pendle introduces.
 */
contract PendleWstETHRegistry is IPendleWstETHRegistry, BaseRegistry {
    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendleWstETHRegistry";

    bytes32 private constant _PENDLE_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.pendleRouter")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PENDLE_PT_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptOracle")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PENDLE_SY_WSTETH_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.syWSTETHToken")) - 1); // solhint-disable-line max-line-length

    // ==================== Initializer ====================

    function initialize(
        address _pendleRouter,
        address _ptOracle,
        address _syWstEthToken,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetPendleRouter(_pendleRouter);
        _ownerSetPtOracle(_ptOracle);
        _ownerSetSyWstEthToken(_syWstEthToken);
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

    function ownerSetPtOracle(
        address _ptOracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtOracle(_ptOracle);
    }

    function ownerSetSyWstEthToken(
        address _syWstEthToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSyWstEthToken(_syWstEthToken);
    }

    // ==================== Views ====================

    function pendleRouter() external view returns (IPendleRouter) {
        return IPendleRouter(_getAddress(_PENDLE_ROUTER_SLOT));
    }

    function ptOracle() external view returns (IPendlePtOracle) {
        return IPendlePtOracle(_getAddress(_PENDLE_PT_ORACLE_SLOT));
    }

    function syWstEthToken() external view returns (IPendleSyToken) {
        return IPendleSyToken(_getAddress(_PENDLE_SY_WSTETH_TOKEN_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetPendleRouter(address _pendleRouter) internal {
        Require.that(
            _pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        _setAddress(_PENDLE_ROUTER_SLOT, _pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }

    function _ownerSetPtOracle(address _ptOracle) internal {
        Require.that(
            _ptOracle != address(0),
            _FILE,
            "Invalid ptOracle address"
        );
        _setAddress(_PENDLE_PT_ORACLE_SLOT, _ptOracle);
        emit PtOracleSet(_ptOracle);
    }

    function _ownerSetSyWstEthToken(address _syWstEthToken) internal {
        Require.that(
            _syWstEthToken != address(0),
            _FILE,
            "Invalid syWstEthToken address"
        );
        _setAddress(_PENDLE_SY_WSTETH_TOKEN_SLOT, _syWstEthToken);
        emit SyWstEthTokenSet(_syWstEthToken);
    }
}
