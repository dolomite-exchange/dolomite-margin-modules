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

import { TestIsolationModeVaultFactory } from "./TestIsolationModeVaultFactory.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestIsolationModeTokenVaultV1WithFreezableAndPausable
 * @author  Dolomite
 *
 * @notice  A test contract for the IsolationModeTokenVaultV1WithFreezableAndPausable contract.
 */
contract TestIsolationModeTokenVaultV1WithFreezableAndPausable is IsolationModeTokenVaultV1WithFreezableAndPausable {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "TestVaultWithFreezablePausable";

    // solhint-disable-next-line max-line-length
    bytes32 private constant _IS_EXTERNAL_REDEMPTION_PAUSED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isExternalRedemptionPaused")) - 1);



    function dolomiteRegistry() public view returns (IDolomiteRegistry) {
        return TestIsolationModeVaultFactory(VAULT_FACTORY()).dolomiteRegistry();
    }

    function setIsVaultFrozen(bool _isFrozen) public {
        _setIsVaultFrozen(_isFrozen);
    }

    function setIsExternalRedemptionPaused(bool _newIsExternalRedemptionPaused) public {
        _setUint256(_IS_EXTERNAL_REDEMPTION_PAUSED_SLOT, _newIsExternalRedemptionPaused ? 1 : 0);
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        return _getUint256(_IS_EXTERNAL_REDEMPTION_PAUSED_SLOT) == 1;
    }

    function testRequireNotFrozen() external requireNotFrozen {}
}
