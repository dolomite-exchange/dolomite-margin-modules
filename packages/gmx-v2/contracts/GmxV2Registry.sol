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

import { BaseRegistry } from "@dolomite-exchange/modules-base/contracts/general/BaseRegistry.sol";
import { HandlerRegistry } from "@dolomite-exchange/modules-base/contracts/general/HandlerRegistry.sol";
import { IHandlerRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IHandlerRegistry.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGmxDataStore } from "./interfaces/IGmxDataStore.sol";
import { IGmxDepositHandler } from "./interfaces/IGmxDepositHandler.sol";
import { IGmxExchangeRouter } from "./interfaces/IGmxExchangeRouter.sol";
import { IGmxReader } from "./interfaces/IGmxReader.sol";
import { IGmxRouter } from "./interfaces/IGmxRouter.sol";
import { IGmxV2Registry } from "./interfaces/IGmxV2Registry.sol";
import { IGmxWithdrawalHandler } from "./interfaces/IGmxWithdrawalHandler.sol";

/**
 * @title   GmxV2Registry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the GMX V2-related addresses. This registry is needed to
 *          offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate (losing any vesting rewards / multiplier
 *          points) when Dolomite needs to point to new contracts or functions that GMX introduces.
 */
contract GmxV2Registry is IGmxV2Registry, BaseRegistry, HandlerRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "GmxV2Registry";

    // solhint-disable max-line-length
    bytes32 private constant _GMX_DATASTORE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxDataStore")) - 1);
    bytes32 private constant _GMX_DEPOSIT_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxDepositVault")) - 1);
    bytes32 private constant _GMX_EXCHANGE_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxExchangeRouter")) - 1);
    bytes32 private constant _GMX_READER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxReader")) - 1);
    bytes32 private constant _GMX_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxRouter")) - 1);
    bytes32 private constant _GMX_WITHDRAWAL_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxWithdrawalVault")) - 1);
    // solhint-enable max-line-length

    // ==================== Initializer ====================

    function initialize(
        address _gmxDataStore,
        address _gmxDepositVault,
        address _gmxExchangeRouter,
        address _gmxReader,
        address _gmxRouter,
        address _gmxWithdrawalVault,
        uint256 _callbackGasLimit,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetGmxDataStore(_gmxDataStore);
        _ownerSetGmxDepositVault(_gmxDepositVault);
        _ownerSetGmxExchangeRouter(_gmxExchangeRouter);
        _ownerSetGmxReader(_gmxReader);
        _ownerSetGmxRouter(_gmxRouter);
        _ownerSetGmxWithdrawalVault(_gmxWithdrawalVault);
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

    function ownerSetGmxDepositVault(
        address _gmxDepositVault
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxDepositVault(_gmxDepositVault);
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

    function ownerSetGmxRouter(
        address _gmxRouter
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxRouter(_gmxRouter);
    }

    function ownerSetGmxWithdrawalVault(
        address _gmxWithdrawalVault
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxWithdrawalVault(_gmxWithdrawalVault);
    }

    // ==================== Views ====================

    function gmxDataStore() external view returns (IGmxDataStore) {
        return IGmxDataStore(_getAddress(_GMX_DATASTORE_SLOT));
    }

    function gmxDepositVault() external view returns (address) {
        return _getAddress(_GMX_DEPOSIT_VAULT_SLOT);
    }

    function gmxExchangeRouter() external view returns (IGmxExchangeRouter) {
        return IGmxExchangeRouter(_getAddress(_GMX_EXCHANGE_ROUTER_SLOT));
    }

    function gmxReader() external view returns (IGmxReader) {
        return IGmxReader(_getAddress(_GMX_READER_SLOT));
    }

    function gmxRouter() external view returns (IGmxRouter) {
        return IGmxRouter(_getAddress(_GMX_ROUTER_SLOT));
    }

    function gmxWithdrawalVault() external view returns (address) {
        return _getAddress(_GMX_WITHDRAWAL_VAULT_SLOT);
    }

    function isHandler(address _handler) public override(HandlerRegistry, IHandlerRegistry) view returns (bool) {
        return super.isHandler(_handler)
            || _handler == address(gmxDepositHandler())
            || _handler == address(gmxWithdrawalHandler());
    }

    function gmxDepositHandler() public view returns (IGmxDepositHandler) {
        return IGmxExchangeRouter(_getAddress(_GMX_EXCHANGE_ROUTER_SLOT)).depositHandler();
    }

    function gmxWithdrawalHandler() public view returns (IGmxWithdrawalHandler) {
        return IGmxExchangeRouter(_getAddress(_GMX_EXCHANGE_ROUTER_SLOT)).withdrawalHandler();
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetGmxDataStore(address _gmxDataStore) internal {
        Require.that(
            _gmxDataStore != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_DATASTORE_SLOT, _gmxDataStore);
        emit GmxDataStoreSet(_gmxDataStore);
    }

    function _ownerSetGmxDepositVault(address _gmxDepositVault) internal {
        Require.that(
            _gmxDepositVault != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_DEPOSIT_VAULT_SLOT, _gmxDepositVault);
        emit GmxDepositVaultSet(_gmxDepositVault);
    }

    function _ownerSetGmxExchangeRouter(address _gmxExchangeRouter) internal {
        Require.that(
            _gmxExchangeRouter != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_EXCHANGE_ROUTER_SLOT, _gmxExchangeRouter);
        emit GmxExchangeRouterSet(_gmxExchangeRouter);
    }

    function _ownerSetGmxReader(address _gmxReader) internal {
        Require.that(
            _gmxReader != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_READER_SLOT, _gmxReader);
        emit GmxReaderSet(_gmxReader);
    }

    function _ownerSetGmxRouter(address _gmxRouter) internal {
        Require.that(
            _gmxRouter != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_ROUTER_SLOT, _gmxRouter);
        emit GmxRouterSet(_gmxRouter);
    }

    function _ownerSetGmxWithdrawalVault(address _gmxWithdrawalVault) internal {
        Require.that(
            _gmxWithdrawalVault != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_GMX_WITHDRAWAL_VAULT_SLOT, _gmxWithdrawalVault);
        emit GmxWithdrawalVaultSet(_gmxWithdrawalVault);
    }
}
