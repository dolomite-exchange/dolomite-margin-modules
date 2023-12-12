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
 * @title   IUmamiAssetVaultWhitelist
 * @author  Dolomite
 *
 * @notice  A whitelist contract for enabling deposits for certain addresses into Umami's Asset Vaults.
 */
interface IUmamiAssetVaultWhitelist {

    /**
     * @notice Updates the whitelist amount for a specific user and asset.
     *
     * @param  _asset   The asset address.
     * @param  _account The user's address.
     * @param  _amount  The new whitelist amount.
     */
    function updateWhitelist(
        address _asset,
        address _account,
        uint256 _amount
    ) external;

    /**
     * @notice Updates the whitelist enabled status.
     *
     * @param  _newVal  The new whitelist enabled status.
     */
    function updateWhitelistEnabled(bool _newVal) external;

    /**
     * @return The address that has the ability to update certain whitelist parameters, like pause status
     */
    function aggregateVault() external view returns (address);

    /**
     * @return Flag for whitelist being enabled or not
     */
    function whitelistEnabled() external view returns (bool);

    /**
     * @notice Checks if a user has priority access to the whitelist for a specific asset.
     *
     * @param  _asset   The asset address.
     * @param  _account The user's address.
     */
    function isWhitelistedPriority(address _asset, address _account) external view returns (bool);
}
