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

import { IsolationModeVaultFactory } from "./abstract/IsolationModeVaultFactory.sol";



/**
 * @title   SimpleIsolationModeTokenFactory
 * @author  Dolomite
 *
 * @notice  Contract for wrapping tokens via a per-user vault that credits a user's balance within DolomiteMargin
 */
contract SimpleIsolationModeVaultFactory is IsolationModeVaultFactory {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "IsolationModeVaultFactory_2";

    // ================================================
    // ==================== Fields ====================
    // ================================================

    uint256[] private _allowableDebtMarketIds;
    uint256[] private _allowableCollateralMarketIds;

    // ===================================================
    // ===================== Events ======================
    // ===================================================

    event AllowableDebtMarketIdsSet(uint256[] allowableDebtMarketIds);
    event AllowableCollateralMarketIdsSet(uint256[] allowableCollateralMarketIds);

    // ================================================
    // ================== Constructor =================
    // ================================================

    constructor(
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _underlyingToken,
        address _borrowPositionProxyV2,
        address _userVaultImplementation,
        address _dolomiteMargin
    ) IsolationModeVaultFactory(
        _underlyingToken,
        _borrowPositionProxyV2,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        _ownerSetAllowableDebtMarketIds(_initialAllowableDebtMarketIds);
        _ownerSetAllowableCollateralMarketIds(_initialAllowableCollateralMarketIds);
    }

    function ownerSetAllowableDebtMarketIds(
        uint256[] calldata _newAllowableDebtMarketIds
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAllowableDebtMarketIds(_newAllowableDebtMarketIds);
    }

    function ownerSetAllowableCollateralMarketIds(
        uint256[] calldata _newAllowableCollateralMarketIds
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAllowableCollateralMarketIds(_newAllowableCollateralMarketIds);
    }

    function allowableDebtMarketIds() external view returns (uint256[] memory) {
        return _allowableDebtMarketIds;
    }

    function allowableCollateralMarketIds() external view returns (uint256[] memory) {
        return _allowableCollateralMarketIds;
    }

    // ================================================
    // =============== Internal Methods ===============
    // ================================================

    function _ownerSetAllowableDebtMarketIds(
        uint256[] memory _newAllowableDebtMarketIds
    ) internal {
        _allowableDebtMarketIds = _newAllowableDebtMarketIds;
        emit AllowableDebtMarketIdsSet(_newAllowableDebtMarketIds);
    }

    function _ownerSetAllowableCollateralMarketIds(
        uint256[] memory _newAllowableCollateralMarketIds
    ) internal {
        _allowableCollateralMarketIds = _newAllowableCollateralMarketIds;
        emit AllowableCollateralMarketIdsSet(_newAllowableCollateralMarketIds);
    }
}
