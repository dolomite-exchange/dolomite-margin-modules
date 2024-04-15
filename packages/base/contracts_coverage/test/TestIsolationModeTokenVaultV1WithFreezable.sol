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

import { TestSimpleIsolationModeVaultFactory } from "./TestSimpleIsolationModeVaultFactory.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezable.sol"; // solhint-disable-line max-line-length

/**
 * @title   TestIsolationModeTokenVaultV1WithFreezable
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeTokenVaultV1WithFreezable contract.
 */
contract TestIsolationModeTokenVaultV1WithFreezable is IsolationModeTokenVaultV1WithFreezable {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "TestVaultV1WithFreezable";

    function dolomiteRegistry() public view returns (IDolomiteRegistry) {
        return TestSimpleIsolationModeVaultFactory(VAULT_FACTORY()).dolomiteRegistry();
    }

    function setIsVaultFrozen(bool _isFrozen) public {
        _setIsVaultFrozen(_isFrozen);
    }

    function testRequireNotFrozen() external requireNotFrozen {}
}
