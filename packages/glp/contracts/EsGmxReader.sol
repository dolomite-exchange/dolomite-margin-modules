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

import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGLPIsolationModeVaultFactory } from "./interfaces/IGLPIsolationModeVaultFactory.sol";


/**
 * @title   EsGmxReader
 * @author  Dolomite
 *
 * @notice  Returns a user's esGmx balance on Dolomite
 */
contract EsGmxReader {

    // ============ Constants ============

    bytes32 private constant _FILE = "EsGmxReader";
    IGLPIsolationModeVaultFactory public immutable GLP_FACTORY;

    // ============ Constructor ============

    constructor(
        address _glpFactory
    ) {
        GLP_FACTORY = IGLPIsolationModeVaultFactory(_glpFactory);
    }

    // ============ View Functions ============

    function balanceOf(address _user) external view returns (uint256) {
        if (GLP_FACTORY.getAccountByVault(_user) == address(0)) {
            return 0;
        }

        return IGLPIsolationModeTokenVaultV2(_user).esGmxBalanceOf();
    }
}
