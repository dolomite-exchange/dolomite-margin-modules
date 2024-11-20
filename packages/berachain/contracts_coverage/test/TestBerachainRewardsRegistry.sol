// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { BerachainRewardsRegistry } from "../BerachainRewardsRegistry.sol";
import { MetaVaultUpgradeableProxy } from "../MetaVaultUpgradeableProxy.sol";


/**
 * @title   TestBerachainRewardsRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the BerachainRewards-related addresses. This registry is
 *          needed to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as
 *          possible without having to deprecate the system and force users to migrate when Dolomite needs to point to
 *          new contracts or functions that Arbitrum introduces.
 */
contract TestBerachainRewardsRegistry is BerachainRewardsRegistry {

    // ================================================
    // ==================== Constants =================
    // ================================================

    bytes32 private constant _FILE = "TestBerachainRewardsRegistry";
    bytes32 private constant _ACCOUNT_TO_META_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.accountToMetaVault")) - 1); // solhint-disable-line max-line-length

    function createMetaVaultNoInitialize(
        address _account,
        address /* _vault */
    ) external {
        address metaVault = Create2.deploy(
            /* amount = */ 0,
            keccak256(abi.encodePacked(_account)),
            type(MetaVaultUpgradeableProxy).creationCode
        );
        _setAddressInMap(_ACCOUNT_TO_META_VAULT_SLOT, _account, metaVault);
    }
}
