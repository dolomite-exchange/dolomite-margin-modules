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
import { ValidationLib } from "@dolomite-exchange/modules-base/contracts/lib/ValidationLib.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IUmamiAssetVaultRegistry } from "./interfaces/IUmamiAssetVaultRegistry.sol";
import { IUmamiAssetVaultStorageViewer } from "./interfaces/IUmamiAssetVaultStorageViewer.sol";

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

    // ==================== Initializer ====================

    function initialize(
        address _storageViewer,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
        _ownerSetStorageViewer(_storageViewer);
    }

    // ==================== Functions ====================

    function ownerSetStorageViewer(
        address _storageViewer
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetStorageViewer(_storageViewer);
    }

    function storageViewer() external view returns (IUmamiAssetVaultStorageViewer) {
        return IUmamiAssetVaultStorageViewer(_getAddress(_STORAGE_VIEWER_SLOT));
    }

    // ============================================================
    // ==================== Internal Functions ====================
    // ============================================================

    function _ownerSetStorageViewer(address _storageViewer) internal {
        if (_storageViewer != address(0)) { /* FOR COVERAGE TESTING */ }
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
}
