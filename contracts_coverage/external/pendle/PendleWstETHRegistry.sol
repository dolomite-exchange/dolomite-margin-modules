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
    bytes32 private constant _PENDLE_PT_WSTETH_2024_MARKET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.wstETH2024Market")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PENDLE_PT_WSTETH_2024_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.wstETH2024Token")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PENDLE_PT_WSTETH_2025_MARKET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.wstETH2025Market")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PENDLE_PT_WSTETH_2025_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.wstETH2025Token")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PENDLE_PT_ORACLE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.ptOracle")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _PENDLE_SY_WSTETH_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.syWSTETHToken")) - 1); // solhint-disable-line max-line-length

    // ==================== Initializer ====================

    function initialize(
        address _pendleRouter,
        address _ptWstEth2024Market,
        address _ptWstEth2024Token,
        address _ptWstEth2025Market,
        address _ptWstEth2025Token,
        address _ptOracle,
        address _syWstEthToken,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetPendleRouter(_pendleRouter);
        _ownerSetPtWstEth2024Market(_ptWstEth2024Market);
        _ownerSetPtWstEth2024Token(_ptWstEth2024Token);
        _ownerSetPtWstEth2025Market(_ptWstEth2025Market);
        _ownerSetPtWstEth2025Token(_ptWstEth2025Token);
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

    function ownerSetPtWstEth2024Market(
        address _ptWstEth2024Market
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtWstEth2024Market(_ptWstEth2024Market);
    }

    function ownerSetPtWstEth2024Token(
        address _ptWstEth2024Token
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtWstEth2024Token(_ptWstEth2024Token);
    }

    function ownerSetPtWstEth2025Market(
        address _ptWstEth2025Market
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtWstEth2025Market(_ptWstEth2025Market);
    }

    function ownerSetPtWstEth2025Token(
        address _ptWstEth2025Token
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetPtWstEth2025Token(_ptWstEth2025Token);
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

    function ptWstEth2024Market() external view returns (IPendlePtMarket) {
        return IPendlePtMarket(_getAddress(_PENDLE_PT_WSTETH_2024_MARKET_SLOT));
    }

    function ptWstEth2024Token() external view returns (IPendlePtToken) {
        return IPendlePtToken(_getAddress(_PENDLE_PT_WSTETH_2024_TOKEN_SLOT));
    }

    function ptWstEth2025Market() external view returns (IPendlePtMarket) {
        return IPendlePtMarket(_getAddress(_PENDLE_PT_WSTETH_2025_MARKET_SLOT));
    }

    function ptWstEth2025Token() external view returns (IPendlePtToken) {
        return IPendlePtToken(_getAddress(_PENDLE_PT_WSTETH_2025_TOKEN_SLOT));
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
        if (_pendleRouter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_pendleRouter != address(0),
            _FILE,
            "Invalid pendleRouter address"
        );
        _setAddress(_PENDLE_ROUTER_SLOT, _pendleRouter);
        emit PendleRouterSet(_pendleRouter);
    }

    function _ownerSetPtWstEth2024Market(address _ptWstEth2024Market) internal {
        if (_ptWstEth2024Market != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptWstEth2024Market != address(0),
            _FILE,
            "Invalid ptWstEthMarket address"
        );
        _setAddress(_PENDLE_PT_WSTETH_2024_MARKET_SLOT, _ptWstEth2024Market);
        emit PtWstEth2024MarketSet(_ptWstEth2024Market);
    }

    function _ownerSetPtWstEth2024Token(address _ptWstEth2024Token) internal {
        if (_ptWstEth2024Token != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptWstEth2024Token != address(0),
            _FILE,
            "Invalid ptWstEthToken address"
        );
        _setAddress(_PENDLE_PT_WSTETH_2024_TOKEN_SLOT, _ptWstEth2024Token);
        emit PtWstEth2024TokenSet(_ptWstEth2024Token);
    }

    function _ownerSetPtWstEth2025Market(address _ptWstEth2025Market) internal {
        if (_ptWstEth2025Market != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptWstEth2025Market != address(0),
            _FILE,
            "Invalid ptWstEthMarket address"
        );
        _setAddress(_PENDLE_PT_WSTETH_2025_MARKET_SLOT, _ptWstEth2025Market);
        emit PtWstEth2025MarketSet(_ptWstEth2025Market);
    }

    function _ownerSetPtWstEth2025Token(address _ptWstEth2025Token) internal {
        if (_ptWstEth2025Token != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_ptWstEth2025Token != address(0),
            _FILE,
            "Invalid ptWstEthToken address"
        );
        _setAddress(_PENDLE_PT_WSTETH_2025_TOKEN_SLOT, _ptWstEth2025Token);
        emit PtWstEth2025TokenSet(_ptWstEth2025Token);
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

    function _ownerSetSyWstEthToken(address _syWstEthToken) internal {
        if (_syWstEthToken != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_syWstEthToken != address(0),
            _FILE,
            "Invalid syWstEthToken address"
        );
        _setAddress(_PENDLE_SY_WSTETH_TOKEN_SLOT, _syWstEthToken);
        emit SyWstEthTokenSet(_syWstEthToken);
    }
}
