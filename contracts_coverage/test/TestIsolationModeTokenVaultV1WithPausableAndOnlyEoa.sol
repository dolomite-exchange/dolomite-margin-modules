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

import { TestIsolationModeFactory } from "./TestIsolationModeFactory.sol";
import { ProxyContractHelpers } from "../external/helpers/ProxyContractHelpers.sol";
import { IDolomiteRegistry } from "../external/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "../external/proxies/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithPausableAndOnlyEoa } from "../external/proxies/abstract/IsolationModeTokenVaultV1WithPausableAndOnlyEoa.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa
 * @author  Dolomite
 *
 * @notice  A test contract for the TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa contract.
 */
contract TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa is
    IsolationModeTokenVaultV1WithPausableAndOnlyEoa,
    ProxyContractHelpers
{

    // solhint-disable-next-line max-line-length
    bytes32 private constant _IS_EXTERNAL_REDEMPTION_PAUSED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isExternalRedemptionPaused")) - 1);

    function setIsExternalRedemptionPaused(bool _newIsExternalRedemptionPaused) public {
        _setUint256(_IS_EXTERNAL_REDEMPTION_PAUSED_SLOT, _newIsExternalRedemptionPaused ? 1 : 0);
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return TestIsolationModeFactory(VAULT_FACTORY()).dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        return _getUint256(_IS_EXTERNAL_REDEMPTION_PAUSED_SLOT) == 1;
    }
}
