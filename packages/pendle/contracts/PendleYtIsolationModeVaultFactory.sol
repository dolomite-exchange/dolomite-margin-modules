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

import { SimpleIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/SimpleIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IPendleRegistry } from "./interfaces/IPendleRegistry.sol";
import { IPendleYtIsolationModeVaultFactory } from "./interfaces/IPendleYtIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IPendleYtToken } from "./interfaces/IPendleYtToken.sol";



/**
 * @title   PendleYtIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  The wrapper around the ytGLP token that is used to create user vaults and manage the entry points that a
 *          user can use to interact with DolomiteMargin from the vault.
 */
contract PendleYtIsolationModeVaultFactory is
    IPendleYtIsolationModeVaultFactory,
    SimpleIsolationModeVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "PendleYtVaultFactory"; // needed to be shortened to fit into 32 bytes

    // ============ Field Variables ============

    // @follow-up Do you remember why WETH WETH_MARKET_ID were here? I think we can remove them
    IPendleRegistry public override pendleRegistry;
    uint256 public override ytMaturityTimestamp;

    // ============ Constructor ============

    constructor(
        address _pendleRegistry,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _ytToken, // this serves as the underlying token
        address _borrowPositionProxyV2,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    SimpleIsolationModeVaultFactory(
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _ytToken,
        _borrowPositionProxyV2,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        pendleRegistry = IPendleRegistry(_pendleRegistry);
        ytMaturityTimestamp = IPendleYtToken(UNDERLYING_TOKEN).expiry();
    }

    // ================================================
    // ============ External Functions ============
    // ================================================

    function ownerSetPendleRegistry(
        address _pendleRegistry
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        pendleRegistry = IPendleRegistry(_pendleRegistry);
        emit PendleRegistrySet(_pendleRegistry);
    }

    function ownerSetYtMaturityTimestamp(
        uint256 _ytMaturityTimestamp
    )
    external
    override
    onlyDolomiteMarginOwner(msg.sender) {
        ytMaturityTimestamp = _ytMaturityTimestamp;
        emit YtMaturityTimestampSet(_ytMaturityTimestamp);
    }

    function _ownerSetAllowableDebtMarketIds(
        uint256[] memory _newAllowableDebtMarketIds
    ) internal override {
        Require.that(
            _newAllowableDebtMarketIds.length > 0,
            _FILE,
            "Invalid allowableDebtMarketIds"
        );

        super._ownerSetAllowableDebtMarketIds(_newAllowableDebtMarketIds);
    }
}
