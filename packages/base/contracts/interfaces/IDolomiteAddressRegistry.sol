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

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


/**
 * @title   IDolomiteAddressRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing restricted Dolomite ERC20 accounts
 */
interface IDolomiteAddressRegistry {

    struct AccountInformation {
        mapping(address => bool) restrictedAccounts;
        mapping(address => EnumerableSet.AddressSet) accountToVaults;
        mapping(address => address) vaultToAccount;
        address[] factories;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event RestrictedAccountSet(address _account, bool _isRestricted);
    event VaultAddedToAccount(address _account, address _vault);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function registerVault(
        address _account,
        address _vault
    ) external;

    function ownerSetRestrictedAccount(
        address _account,
        bool _isRestricted
    )
    external;

    function isRestrictedAccount(address _account) external view returns (bool);

    function isIsolationModeVault(address _vault) external view returns (bool);

    function getAccountByVault(address _vault) external view returns (address);

    function getVaultsByAccount(address _account) external view returns (address[] memory);

    function getFactories() external view returns (address[] memory);

    function isMarketIdIsolationMode(uint256 _marketId) external view returns (bool);

    function isTokenIsolationMode(address _token) external view returns (bool);
}