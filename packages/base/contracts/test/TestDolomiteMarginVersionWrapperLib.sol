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

import { IExpiry } from "../interfaces/IExpiry.sol";
import { DolomiteMarginVersionWrapperLib } from "../lib/DolomiteMarginVersionWrapperLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   TestDolomiteMarginVersionWrapperLib
 * @author  Dolomite
 *
 * @notice  Test contract for DolomiteMarginVersionWrapperLib
 */
contract TestDolomiteMarginVersionWrapperLib {
    using DolomiteMarginVersionWrapperLib for *;

    // ============ Constants ============

    bytes32 private constant _FILE = "TestDolomiteVersionWrapperLib";

    // ===========================================
    // ============= Public Functions ============
    // ===========================================

    function getVersionedLiquidationSpreadForPair(
        IDolomiteMargin _dolomiteMargin,
        uint256 _chainId,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _heldMarketId,
        uint256 _owedMarketId
    ) public view returns (IDolomiteStructs.Decimal memory) {
        return DolomiteMarginVersionWrapperLib.getVersionedLiquidationSpreadForPair(
            _dolomiteMargin,
            _chainId,
            _liquidAccount,
            _heldMarketId,
            _owedMarketId
        );
    }

    function getVersionedSpreadAdjustedPrices(
        IExpiry _expiry,
        uint256 _chainId,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _heldMarketId,
        uint256 _owedMarketId,
        uint32 _expiration
    ) public view returns (
        IDolomiteStructs.MonetaryPrice memory heldPrice,
        IDolomiteStructs.MonetaryPrice memory owedPriceAdj
    ) {
        return DolomiteMarginVersionWrapperLib.getVersionedSpreadAdjustedPrices(
            _expiry,
            _chainId,
            _liquidAccount,
            _heldMarketId,
            _owedMarketId,
            _expiration
        );
    }
}
