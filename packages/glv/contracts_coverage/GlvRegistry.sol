// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { BaseRegistry } from "@dolomite-exchange/modules-base/contracts/general/BaseRegistry.sol";
import { HandlerRegistry } from "@dolomite-exchange/modules-base/contracts/general/HandlerRegistry.sol";
import { IHandlerRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IHandlerRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGmxDataStore } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxDataStore.sol";
import { IGmxExchangeRouter } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxExchangeRouter.sol";
import { IGmxReader } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxReader.sol";
import { IGlvHandler } from "./interfaces/IGlvHandler.sol";
import { IGlvReader } from "./interfaces/IGlvReader.sol";
import { IGlvRegistry } from "./interfaces/IGlvRegistry.sol";
import { IGlvRouter } from "./interfaces/IGlvRouter.sol";

/**
 * @title   GlvRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the GLV related addresses. This registry is needed to
 *          offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate (losing any vesting rewards / multiplier
 *          points) when Dolomite needs to point to new contracts or functions that GMX introduces.
 */
contract GlvRegistry is IGlvRegistry, BaseRegistry, HandlerRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "GlvRegistry";

    // solhint-disable max-line-length
    bytes32 private constant _GMX_DATASTORE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxDataStore")) - 1);
    bytes32 private constant _GMX_EXCHANGE_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxExchangeRouter")) - 1);
    bytes32 private constant _GLV_HANDLER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glvHandler")) - 1);
    bytes32 private constant _GLV_READER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glvReader")) - 1);
    bytes32 private constant _GMX_READER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxReader")) - 1);
    bytes32 private constant _GLV_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glvRouter")) - 1);
    bytes32 private constant _GLV_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glvVault")) - 1);
    bytes32 private constant _UNDERLYING_GM_MARKET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.underlyingMarket")) - 1);
    // solhint-enable max-line-length

    // ==================== Initializer ====================

    function initialize(
        address _gmxDataStore,
        address _gmxExchangeRouter,
        address _gmxReader,
        address _glvHandler,
        address _glvReader,
        address _glvRouter,
        address _glvVault,
        address _underlyingGmMarket,
        uint256 _callbackGasLimit,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetGmxDataStore(_gmxDataStore);
        _ownerSetGmxExchangeRouter(_gmxExchangeRouter);
        _ownerSetGmxReader(_gmxReader);
        _ownerSetGlvHandler(_glvHandler);
        _ownerSetGlvReader(_glvReader);
        _ownerSetGlvRouter(_glvRouter);
        _ownerSetGlvVault(_glvVault);
        _ownerSetUnderlyingGmMarket(_underlyingGmMarket);
        _ownerSetCallbackGasLimit(_callbackGasLimit);

        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    // ==================== Functions ====================

    function ownerSetGmxDataStore(
        address _gmxDataStore
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxDataStore(_gmxDataStore);
    }

    function ownerSetGmxExchangeRouter(
        address _gmxExchangeRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxExchangeRouter(_gmxExchangeRouter);
    }

    function ownerSetGmxReader(
        address _gmxReader
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxReader(_gmxReader);
    }

    function ownerSetGlvHandler(
        address _glvHandler
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlvHandler(_glvHandler);
    }

    function ownerSetGlvReader(
        address _glvReader
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlvReader(_glvReader);
    }

    function ownerSetGlvRouter(
        address _glvRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlvRouter(_glvRouter);
    }

    function ownerSetGlvVault(
        address _glvVault
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlvVault(_glvVault);
    }

    function ownerSetUnderlyingGmMarket(
        address _underlyingGmMarket
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetUnderlyingGmMarket(_underlyingGmMarket);
    }

    // ==================== Views ====================

    function gmxDataStore() external view returns (IGmxDataStore) {
        return IGmxDataStore(_getAddress(_GMX_DATASTORE_SLOT));
    }

    function gmxExchangeRouter() external view returns (IGmxExchangeRouter) {
        return IGmxExchangeRouter(_getAddress(_GMX_EXCHANGE_ROUTER_SLOT));
    }

    function gmxReader() external view returns (IGmxReader) {
        return IGmxReader(_getAddress(_GMX_READER_SLOT));
    }

    function glvReader() external view returns (IGlvReader) {
        return IGlvReader(_getAddress(_GLV_READER_SLOT));
    }

    function glvRouter() external view returns (IGlvRouter) {
        return IGlvRouter(_getAddress(_GLV_ROUTER_SLOT));
    }

    function glvVault() external view returns (address) {
        return _getAddress(_GLV_VAULT_SLOT);
    }

    function underlyingGmMarket() external view returns (address) {
        return _getAddress(_UNDERLYING_GM_MARKET_SLOT);
    }

    function isHandler(address _handler) public override(HandlerRegistry, IHandlerRegistry) view returns (bool) {
        return super.isHandler(_handler)
            || _handler == address(glvHandler());
    }

    function glvHandler() public view returns (IGlvHandler) {
        return IGlvHandler(_getAddress(_GLV_HANDLER_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetGmxDataStore(address _gmxDataStore) internal {
        if (_gmxDataStore != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _gmxDataStore != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_DATASTORE_SLOT, _gmxDataStore);
        emit GmxDataStoreSet(_gmxDataStore);
    }

    function _ownerSetGmxExchangeRouter(address _gmxExchangeRouter) internal {
        if (_gmxExchangeRouter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _gmxExchangeRouter != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_EXCHANGE_ROUTER_SLOT, _gmxExchangeRouter);
        emit GmxExchangeRouterSet(_gmxExchangeRouter);
    }

    function _ownerSetGmxReader(address _gmxReader) internal {
        if (_gmxReader != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _gmxReader != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_READER_SLOT, _gmxReader);
        emit GmxReaderSet(_gmxReader);
    }

    function _ownerSetGlvHandler(address _glvHandler) internal {
        if (_glvHandler != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _glvHandler != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GLV_HANDLER_SLOT, _glvHandler);
        emit GlvHandlerSet(_glvHandler);
    }

    function _ownerSetGlvReader(address _glvReader) internal {
        if (_glvReader != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _glvReader != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GLV_READER_SLOT, _glvReader);
        emit GlvReaderSet(_glvReader);
    }

    function _ownerSetGlvRouter(address _glvRouter) internal {
        if (_glvRouter != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _glvRouter != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GLV_ROUTER_SLOT, _glvRouter);
        emit GlvRouterSet(_glvRouter);
    }

    function _ownerSetGlvVault(address _glvVault) internal {
        if (_glvVault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _glvVault != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GLV_VAULT_SLOT, _glvVault);
        emit GlvVaultSet(_glvVault);
    }

    function _ownerSetUnderlyingGmMarket(address _underlyingGmMarket) internal {
        if (_underlyingGmMarket != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _underlyingGmMarket != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_UNDERLYING_GM_MARKET_SLOT, _underlyingGmMarket);
        emit UnderlyingGmMarketSet(_underlyingGmMarket);
    }
}
