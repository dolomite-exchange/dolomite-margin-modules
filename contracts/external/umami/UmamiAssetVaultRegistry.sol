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
import { IUmamiAssetVaultRegistry } from "../interfaces/umami/IUmamiAssetVaultRegistry.sol";
import { IUmamiAssetVaultStorageViewer } from "../interfaces/umami/IUmamiAssetVaultStorageViewer.sol";
import { IUmamiAssetVaultIsolationModeUnwrapperTraderV2 } from "../interfaces/umami/IUmamiAssetVaultIsolationModeUnwrapperTraderV2.sol";
import { IUmamiWithdrawalQueuer } from "../interfaces/umami/IUmamiWithdrawalQueuer.sol";
import { ValidationLib } from "../lib/ValidationLib.sol";

/**
 * @title   UmamiAssetVaultRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Umami-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Umami introduces.
 */
contract UmamiAssetVaultRegistry is IUmamiAssetVaultRegistry, BaseRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "UmamiAssetVaultRegistry";
    bytes32 private constant _STORAGE_VIEWER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.storageViewer")) - 1);
    bytes32 private constant _WITHDRAWAL_QUEUER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.withdrawalQueuer")) - 1);
    bytes32 private constant _UMAMI_UNWRAPPER_TRADER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.umamiUnwrapperTrader")) - 1);

    // ==================== Initializer ====================

    function initialize(
        address _storageViewer,
        address _withdrawalQueuer,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
        _ownerSetStorageViewer(_storageViewer);
        _ownerSetWithdrawalQueuer(_withdrawalQueuer);
    }

    // ==================== Functions ====================

    function ownerSetStorageViewer(
        address _storageViewer
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetStorageViewer(_storageViewer);
    }

    function ownerSetWithdrawalQueuer(
        address _withdrawalQueuer
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetWithdrawalQueuer(_withdrawalQueuer);
    }

    function ownerSetUmamiUnwrapperTrader(
        address _gmxV2UnwrapperTrader
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetUmamiUnwrapperTrader(_gmxV2UnwrapperTrader);
    }


    function storageViewer() external view returns (IUmamiAssetVaultStorageViewer) {
        return IUmamiAssetVaultStorageViewer(_getAddress(_STORAGE_VIEWER_SLOT));
    }

    function withdrawalQueuer() external view returns (IUmamiWithdrawalQueuer) {
        return IUmamiWithdrawalQueuer(_getAddress(_WITHDRAWAL_QUEUER_SLOT));
    }

    function umamiUnwrapperTrader() external view returns (IUmamiAssetVaultIsolationModeUnwrapperTraderV2) {
        return IUmamiAssetVaultIsolationModeUnwrapperTraderV2(_getAddress(_UMAMI_UNWRAPPER_TRADER_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetStorageViewer(address _storageViewer) internal {
        Require.that(
            _storageViewer != address(0),
            _FILE,
            "Invalid storageViewer address"
        );

        (bytes memory data) = ValidationLib.callAndCheckSuccess(
            _storageViewer,
            IUmamiAssetVaultStorageViewer(_storageViewer).getVaultFees.selector,
            bytes("")
        );
        abi.decode(data, (IUmamiAssetVaultStorageViewer.VaultFees)); // If this doesn't work, it'll revert

        _setAddress(_STORAGE_VIEWER_SLOT, _storageViewer);
        emit StorageViewerSet(_storageViewer);
    }

    function _ownerSetWithdrawalQueuer(address _withdrawalQueuer) internal {
        Require.that(
            _withdrawalQueuer != address(0),
            _FILE,
            "Invalid storageViewer address"
        );

        _setAddress(_WITHDRAWAL_QUEUER_SLOT, _withdrawalQueuer);
        emit WithdrawalQueuerSet(_withdrawalQueuer);
    }

    function _ownerSetUmamiUnwrapperTrader(address _umamiUnwrapperTrader) internal {
        Require.that(
            _umamiUnwrapperTrader != address(0),
            _FILE,
            "Invalid address"
        );
        _setAddress(_UMAMI_UNWRAPPER_TRADER_SLOT, _umamiUnwrapperTrader);
        emit UmamiUnwrapperTraderSet(_umamiUnwrapperTrader);
    }
}
