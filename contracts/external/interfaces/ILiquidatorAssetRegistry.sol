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

/**
 * @title   ILiquidatorAssetRegistry
 * @author  Dolomite
 *
 * Interface for a registry that tracks which assets can be liquidated and by each contract
 */
interface ILiquidatorAssetRegistry {

    /**
     *
     * @param  _marketId    The market ID of the asset to check
     * @return              An array of whitelisted liquidators for the asset. An empty array is returned if any
     *                      liquidator can be used for this asset
     */
    function getLiquidatorsForAsset(
        uint256 _marketId
    )
    external view returns (address[] memory);

    /**
     *
     * @param  _marketId    The market ID of the asset to check
     * @param  _liquidator  The address of the liquidator to check
     * @return              True if the liquidator is whitelisted for the asset, false otherwise. Returns true if there
     *                      are no whitelisted liquidators for the asset. Should ALWAYS have at least ONE whitelisted
     *                      liquidator for IsolationMode assets.
     */
    function isAssetWhitelistedForLiquidation(
        uint256 _marketId,
        address _liquidator
    )
    external view returns (bool);
}
