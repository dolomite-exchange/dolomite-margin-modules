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

import { GmxV2IsolationModeVaultFactory } from "../external/gmxV2/GmxV2IsolationModeVaultFactory.sol";
import { IGenericTraderProxyV1 } from "../external/interfaces/IGenericTraderProxyV1.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   TestGmxV2IsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxV2IsolationModeVaultFactory is GmxV2IsolationModeVaultFactory {

    // ============ Enums ============

    enum ReversionType {
        None,
        Revert,
        Require
    }

    // ============ Storage ============

    ReversionType public reversionType;

    // ======== Constructor =========

    constructor(
        address _gmxRegistryV2,
        MarketInfoConstructorParams memory _tokenAndMarketAddresses,
        uint256[] memory _initialAllowableDebtMarketIds,
        uint256[] memory _initialAllowableCollateralMarketIds,
        address _borrowPositionProxyV2,
        address _userVaultImplementation,
        address _dolomiteMargin
    ) GmxV2IsolationModeVaultFactory(
        _gmxRegistryV2,
        _tokenAndMarketAddresses,
        _initialAllowableDebtMarketIds,
        _initialAllowableCollateralMarketIds,
        _borrowPositionProxyV2,
        _userVaultImplementation,
        _dolomiteMargin
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
            assert(false);
        } else if (reversionType == ReversionType.Require && _vaultAccountNumber != 0) {
            require(false, "Reversion");
        }
        reversionType = ReversionType.None; // undo it after the first reversion
    }
}
