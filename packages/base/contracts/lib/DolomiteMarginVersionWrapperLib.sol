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

import { ChainHelperLib } from "./ChainHelperLib.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { IExpiryV2 } from "../interfaces/IExpiryV2.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginV2 } from "../protocol/interfaces/IDolomiteMarginV2.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   DolomiteMarginVersionWrapperLib
 * @author  Dolomite
 *
 * @notice  Library contract that discovers which chain we're on
 */
library DolomiteMarginVersionWrapperLib {
    using DolomiteMarginVersionWrapperLib for *;

    // ============ Constants ============

    bytes32 private constant _FILE = "DolomiteMarginVersionWrapperLib";

    // ===========================================
    // ============= Public Functions ============
    // ===========================================

    function getVersionedLiquidationSpreadForPair(
        IDolomiteMargin _dolomiteMargin,
        uint256 _chainId,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _heldMarketId,
        uint256 _owedMarketId
    ) internal view returns (IDolomiteStructs.Decimal memory) {
        if (ChainHelperLib.isArbitrum(_chainId)) {
            return _dolomiteMargin.getLiquidationSpreadForPair(_heldMarketId, _owedMarketId);
        } else {
            return dv2(_dolomiteMargin).getLiquidationSpreadForAccountAndPair(
                _liquidAccount,
                _heldMarketId,
                _owedMarketId
            );
        }
    }

    function getVersionedSpreadAdjustedPrices(
        IExpiry _expiry,
        uint256 _chainId,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _heldMarketId,
        uint256 _owedMarketId,
        uint32 _expiration
    ) internal view returns (
        IDolomiteStructs.MonetaryPrice memory heldPrice,
        IDolomiteStructs.MonetaryPrice memory owedPriceAdj
    ) {
        if (ChainHelperLib.isArbitrum(_chainId)) {
            (heldPrice, owedPriceAdj) = _expiry.getSpreadAdjustedPrices(_heldMarketId, _owedMarketId, _expiration);
        } else {
            (heldPrice, owedPriceAdj) = ev2(_expiry).getLiquidationSpreadAdjustedPrices(
                _liquidAccount,
                _heldMarketId,
                _owedMarketId,
                _expiration
            );
        }
    }

    function getVersionedMaxSupplyWei(
        IDolomiteMargin _dolomiteMargin,
        uint256 _chainId,
        uint256 _marketId
    ) internal view returns (IDolomiteStructs.Wei memory) {
        if (ChainHelperLib.isArbitrum(_chainId)) {
            return _dolomiteMargin.getMarket(_marketId).maxWei;
        } else {
            return dv2(_dolomiteMargin).getMarket(_marketId).maxSupplyWei;
        }
    }

    // ===========================================
    // ============ Private Functions ============
    // ===========================================

    function dv2(IDolomiteMargin _dolomiteMargin) private pure returns (IDolomiteMarginV2) {
        return IDolomiteMarginV2(address(_dolomiteMargin));
    }

    function ev2(IExpiry _expiry) private pure returns (IExpiryV2) {
        return IExpiryV2(address(_expiry));
    }
}
