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
 * @title   IUmamiAggregateVault
 * @author  Dolomite
 *
 * @notice  A whitelist contract for enabling deposits for certain addresses into Umami's Asset Vaults.
 */
interface IUmamiAggregateVault {

    /**
     * @notice Only callable by an Umami configurator, like `0x7A53700c4d2DD1Eb9809a63679A6a5b6c4e31d97`
     *
     * @param  _newCaps The caps for each vault, corresponding with the vault's indices
     */
    function setVaultCaps(uint256[5] calldata _newCaps) external;

    /**
     * @notice Sets the vault fees
     *
     * @param  _performanceFee          The performance fee value to set
     * @param  _managementFee           The management fee value to set
     * @param  _withdrawalFee           The withdrawal fee value to set
     * @param  _depositFee              The deposit fee value to set
     * @param  _timelockBoostPercent    The timelock boost percent value to set
     */
    function setVaultFees(
        uint256 _performanceFee,
        uint256 _managementFee,
        uint256 _withdrawalFee,
        uint256 _depositFee,
        uint256 _timelockBoostPercent
    ) external;
}
