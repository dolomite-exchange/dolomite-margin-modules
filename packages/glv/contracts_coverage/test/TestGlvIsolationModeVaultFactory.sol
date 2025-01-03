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

import { GlvIsolationModeVaultFactory } from "../GlvIsolationModeVaultFactory.sol";


/**
 * @title   TestGlvIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGlvIsolationModeVaultFactory is GlvIsolationModeVaultFactory {

    // ============ Enums ============

    enum ReversionType {
        None,
        Revert,
        Require
    }

    // ============ Storage ============

    ReversionType public reversionType;

    // ======== Errors =========

    error RevertError(string message);

    // ======== Constructor =========

    constructor(
        ConstructorParams memory _params
    ) GlvIsolationModeVaultFactory(
        _params
    ) { /* solhint-disable-line no-empty-blocks */ }

    // ============ Functions ============

    function setReversionType(ReversionType _reversionType) external {
        reversionType = _reversionType;
    }

    function _depositIntoDolomiteMarginFromTokenConverter(
        address _vault,
        uint256 _vaultAccountNumber,
        uint256 _amountWei
    ) internal override {
        super._depositIntoDolomiteMarginFromTokenConverter(_vault, _vaultAccountNumber, _amountWei);
        if (reversionType == ReversionType.Revert && _vaultAccountNumber != 0) {
            revert RevertError("Reversion");
        } else if (reversionType == ReversionType.Require && _vaultAccountNumber != 0) {
            require(false, "Reversion");
        }
    }
}
