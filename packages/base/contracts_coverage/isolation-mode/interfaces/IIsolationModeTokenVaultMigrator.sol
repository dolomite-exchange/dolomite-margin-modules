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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IDolomiteRegistry } from "../../interfaces/IDolomiteRegistry.sol";

/**
 * @title   IIsolationModeTokenVaultMigrator
 * @author  Dolomite
 *
 * @notice
 */
interface IIsolationModeTokenVaultMigrator {

    function DOLOMITE_REGISTRY() external view returns (IDolomiteRegistry);

    function VAULT_FACTORY() external view returns (address);

    function MIGRATION_TOKEN() external view returns (IERC20);

    function migrate(uint256 _amountWei) external;

    function executeWithdrawalFromVault(address _recipient, uint256 _amount) external;
}
