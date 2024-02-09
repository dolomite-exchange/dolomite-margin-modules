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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IARB } from "./interfaces/IARB.sol";
import { IARBIsolationModeTokenVaultV1 } from "./interfaces/IARBIsolationModeTokenVaultV1.sol";
import { IARBIsolationModeVaultFactory } from "./interfaces/IARBIsolationModeVaultFactory.sol";
import { IARBRegistry } from "./interfaces/IARBRegistry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol";


/**
 * @title   ARBIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract ARBIsolationModeTokenVaultV1 is
    IARBIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1
{
    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "ARBIsolationModeTokenVaultV1";

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function delegate(address _delegatee) external onlyVaultOwner(msg.sender) {
        _delegate(_delegatee);
    }

    function delegates() external view returns (address) {
        return _arb().delegates(/* _account = */ address(this));
    }

    function registry() public view returns (IARBRegistry) {
        return IARBIsolationModeVaultFactory(VAULT_FACTORY()).arbRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function _initialize() internal override {
        super._initialize();

        address originalDelegate = _arb().delegates(OWNER());
        if (originalDelegate != address(0)) {
            _delegate(originalDelegate);
        } else {
            // Delegate to the vault owner by default
            _delegate(OWNER());
        }
    }

    function _delegate(address _delegatee) internal {
        if (_delegatee != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _delegatee != address(0),
            _FILE,
            "Invalid delegatee"
        );

        _arb().delegate(_delegatee);
    }

    function _arb() internal view returns (IARB) {
        return IARB(IIsolationModeVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN());
    }
}
