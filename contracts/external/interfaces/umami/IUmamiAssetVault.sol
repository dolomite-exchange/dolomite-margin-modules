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
     * @notice Pause deposit and withdrawal operations. Only callable by AggregateVault.
     */
    function pauseDepositWithdraw() external;

    /**
     * @notice Unpause deposit and withdrawal operations. Only callable by AggregateVault.
     */
    function unpauseDepositWithdraw() external;

    /**
     * @dev Returns true if withdrawing from the contract is paused, and false otherwise.
     */
    function withdrawalPaused() external view returns (bool);

    /**
     * @dev Returns the current aggregateVault address.
     */
    function aggregateVault() external view returns (address);

    /**
     * @dev Returns the withdrawal fee for the amount of `_assets` to be withdrawn
     */
    function previewWithdrawalFee(uint256 _assets) external view returns (uint256);
}
