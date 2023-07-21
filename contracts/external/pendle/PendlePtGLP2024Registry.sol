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
import { IPendlePtGLP2024Registry } from "../interfaces/pendle/IPendlePtGLP2024Registry.sol";
import { IPendlePtMarket } from "../interfaces/pendle/IPendlePtMarket.sol";
import { IPendlePtOracle } from "../interfaces/pendle/IPendlePtOracle.sol";
import { IPendlePtToken } from "../interfaces/pendle/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IPendleSyToken } from "../interfaces/pendle/IPendleSyToken.sol";


/**
 * @title   PendlePtGLP2024Registry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the PlutusDAO-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that PlutusDAO introduces.
 */
contract PendlePtGLP2024Registry is IPendlePtGLP2024Registry, BaseRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "PendlePtGLP2024Registry";
    bytes32 private constant _PENDLE_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.pendleRouter")) - 1);
    bytes32 private constant _PT_GLP_MARKET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptGlpMarket")) - 1);
    bytes32 private constant _PT_GLP_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptGlpToken")) - 1);
    bytes32 private constant _PT_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptOracle")) - 1);
    bytes32 private constant _SY_GLP_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.syGlpToken")) - 1);

    // ==================== Constructor ====================

    function initialize(
        address _pendleRouter,
        address _ptGlpMarket,
        address _ptGlpToken,
        address _ptOracle,
        address _syGlpToken,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetPendleRouter(_pendleRouter);
        _ownerSetPtGlpMarket(_ptGlpMarket);
        _ownerSetPtGlpToken(_ptGlpToken);
        _ownerSetPtOracle(_ptOracle);
        _ownerSetSyGlpToken(_syGlpToken);
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

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

    function ownerSetPtGlpToken(
        address _ptGlpToken
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtGlpToken(_ptGlpToken);
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

    // ==================== Public Functions ====================

    function pendleRouter() public view returns (IPendleRouter) {
        return IPendleRouter(_getAddress(_PENDLE_ROUTER_SLOT));
    }

    function ptGlpMarket() public view returns (IPendlePtMarket) {
        return IPendlePtMarket(_getAddress(_PT_GLP_MARKET_SLOT));
    }

    function ptGlpToken() public view returns (IPendlePtToken) {
        return IPendlePtToken(_getAddress(_PT_GLP_TOKEN_SLOT));
    }

    function ptOracle() public view returns (IPendlePtOracle) {
        return IPendlePtOracle(_getAddress(_PT_ORACLE_SLOT));
    }

    function syGlpToken() public view returns (IPendleSyToken) {
        return IPendleSyToken(_getAddress(_SY_GLP_TOKEN_SLOT));
    }

    // =================== Internal Functions ===================

    function _ownerSetPendleRouter(address _pendleRouter) internal {
        Require.that(
            _pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        _setAddress(_PENDLE_ROUTER_SLOT, _pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }

    function _ownerSetPtGlpMarket(address _ptGlpMarket) internal {
        Require.that(
            _ptGlpMarket != address(0),
            _FILE,
            "Invalid ptGlpMarket address"
        );
        _setAddress(_PT_GLP_MARKET_SLOT, _ptGlpMarket);
        emit PtGlpMarketSet(_ptGlpMarket);
    }

    function _ownerSetPtGlpToken(address _ptGlpToken) internal {
        Require.that(
            _ptGlpToken != address(0),
            _FILE,
            "Invalid ptGlpToken address"
        );
        _setAddress(_PT_GLP_TOKEN_SLOT, _ptGlpToken);
        emit PtGlpTokenSet(_ptGlpToken);
    }

    function _ownerSetPtOracle(address _ptOracle) internal {
        Require.that(
            _ptOracle != address(0),
            _FILE,
            "Invalid ptOracle address"
        );
        _setAddress(_PT_ORACLE_SLOT, _ptOracle);
        emit PtOracleSet(_ptOracle);
    }

    function _ownerSetSyGlpToken(address _syGlpToken) internal {
        Require.that(
            _syGlpToken != address(0),
            _FILE,
            "Invalid syGlpToken address"
        );
        _setAddress(_SY_GLP_TOKEN_SLOT, _syGlpToken);
        emit SyGlpTokenSet(_syGlpToken);
    }
}
