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

import { Require } from "../protocol/lib/Require.sol";
import { IsolationModeVaultFactory } from "./abstract/IsolationModeVaultFactory.sol";



/**
 * @title   SimpleIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Contract for wrapping tokens via a per-user vault that credits a user's balance within DolomiteMargin
 */
contract SimpleIsolationModeVaultFactory is IsolationModeVaultFactory {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "SimpleIsolationModeVaultFactory";

    // ================================================
    // ==================== Fields ====================
    // ================================================

    uint256[] internal _allowableDebtMarketIds;
    uint256[] internal _allowableCollateralMarketIds;

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
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) IsolationModeVaultFactory(
        _underlyingToken,
        _borrowPositionProxyV2,
        _userVaultImplementation,
        _dolomiteRegistry,
        _dolomiteMargin
    ) {
        _ownerSetAllowableDebtMarketIds(_initialAllowableDebtMarketIds);
        _ownerSetAllowableCollateralMarketIds(_initialAllowableCollateralMarketIds);
    }

    function ownerSetAllowableDebtMarketIds(
        uint256[] calldata _newAllowableDebtMarketIds
    )
    external
    virtual
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAllowableDebtMarketIds(_newAllowableDebtMarketIds);
    }

    function ownerSetAllowableCollateralMarketIds(
        uint256[] calldata _newAllowableCollateralMarketIds
    )
    external
    virtual
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
    ) internal virtual {
        uint256 len = _newAllowableDebtMarketIds.length;
        for (uint256 i; i < len; i++) {
            Require.that(
                !DOLOMITE_MARGIN().getMarketIsClosing(_newAllowableDebtMarketIds[i]),
                _FILE,
                "Market cannot be closing"
            );
        }

        _allowableDebtMarketIds = _newAllowableDebtMarketIds;
        emit AllowableDebtMarketIdsSet(_newAllowableDebtMarketIds);
    }

    function _ownerSetAllowableCollateralMarketIds(
        uint256[] memory _newAllowableCollateralMarketIds
    ) internal virtual {
        _allowableCollateralMarketIds = _newAllowableCollateralMarketIds;
        emit AllowableCollateralMarketIdsSet(_newAllowableCollateralMarketIds);
    }

    function _afterInitialize() internal virtual override {
        if (_allowableCollateralMarketIds.length > 0) {
            // Only add this isolated market ID if the user is restricted by which collateral assets they may use
            _allowableCollateralMarketIds.push(marketId);
        }
    }
}
