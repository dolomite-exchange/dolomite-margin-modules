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
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IUmamiAssetVaultRegistry } from "../interfaces/umami/IUmamiAssetVaultRegistry.sol";
import { IUmamiAssetVaultStorageViewer } from "../interfaces/umami/IUmamiAssetVaultStorageViewer.sol";
import { IUmamiAssetVaultWhitelist } from "../interfaces/umami/IUmamiAssetVaultWhitelist.sol";


/**
 * @title   UmamiAssetVaultRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the Umami-related addresses. This registry is needed
 *          to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate when Dolomite needs to point to new
 *          contracts or functions that Umami introduces.
 */
contract UmamiAssetVaultRegistry is IUmamiAssetVaultRegistry, OnlyDolomiteMargin, BaseRegistry {

    // ==================== Constants ====================

    bytes32 private constant _FILE = "UmamiAssetVaultRegistry";

    // ==================== Storage ====================

    IUmamiAssetVaultWhitelist public override whitelist;
    IUmamiAssetVaultStorageViewer public override storageViewer;

    // ==================== Constructor ====================

    constructor(
        address _whitelist,
        address _storageViewer,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        whitelist = IUmamiAssetVaultWhitelist(_whitelist);
        storageViewer = IUmamiAssetVaultStorageViewer(_storageViewer);
    }

    function ownerSetWhitelist(
        address _whitelist
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _whitelist != address(0),
            _FILE,
            "Invalid whitelist address"
        );

        (bytes memory data) = _callAndCheckSuccess(_whitelist, whitelist.aggregateVault.selector, bytes(""));
        abi.decode(data, (address)); // If this doesn't work, it'll revert

        whitelist = IUmamiAssetVaultWhitelist(_whitelist);
        emit WhitelistSet(_whitelist);
    }

    function ownerSetStorageViewer(
        address _storageViewer
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _storageViewer != address(0),
            _FILE,
            "Invalid storageViewer address"
        );

        (bytes memory data) = _callAndCheckSuccess(_storageViewer, storageViewer.getVaultFees.selector, bytes(""));
        abi.decode(data, (IUmamiAssetVaultStorageViewer.VaultFees)); // If this doesn't work, it'll revert

        storageViewer = IUmamiAssetVaultStorageViewer(_storageViewer);
        emit StorageViewerSet(_storageViewer);
    }
}
