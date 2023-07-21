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

import { IDolomiteRegistry } from "../external/interfaces/IDolomiteRegistry.sol";
import { SimpleIsolationModeVaultFactory } from "../external/proxies/SimpleIsolationModeVaultFactory.sol";



/**
 * @title   TestSimpleIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Test contract for wrapping tokens via a per-user vault that credits a user's balance within DolomiteMargin
 */
contract TestSimpleIsolationModeVaultFactory is SimpleIsolationModeVaultFactory {

    // ================================================
    // ==================== Fields ====================
    // ================================================

    IDolomiteRegistry public override dolomiteRegistry;

    // ================================================
    // ================== Constructor =================
    // ================================================

    constructor(
        address _dolomiteRegistry,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _underlyingToken,
        address _borrowPositionProxyV2,
        address _userVaultImplementation,
        address _dolomiteMargin
    ) SimpleIsolationModeVaultFactory(
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _underlyingToken,
        _borrowPositionProxyV2,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        dolomiteRegistry = IDolomiteRegistry(_dolomiteRegistry);
    }
}
