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

import { IERC4626 } from "../IERC4626.sol";


/**
 * @title   IUmamiAssetVault
 * @author  Dolomite
 *
 * @notice  A subclass of ERC4626 which contains special functions for Umami's Delta Neutral vaults
 */
interface IUmamiAssetVault is IERC4626 {

    /**
     * @notice Preview the deposit fee for a specified amount of assets
     *
     * @param  _size            The amount of assets to preview the deposit fee for
     * @return _totalDepositFee The total deposit fee for the specified amount of assets
     */
    function previewDepositFee(uint256 _size) external view returns (uint256 _totalDepositFee);

    /**
     * @notice Preview the withdrawal fee for a specified amount of assets
     *
     * @param  _size                The amount of assets to preview the withdrawal fee for
     * @return _totalWithdrawalFee  The total withdrawal fee for the specified amount of assets
     */
    function previewWithdrawalFee(uint256 _size) external view returns (uint256 _totalWithdrawalFee);
}
