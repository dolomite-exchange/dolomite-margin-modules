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

import { IDepositCallbackReceiver } from "../interfaces/gmx/IDepositCallbackReceiver.sol";
import { Deposit } from "../interfaces/gmx/Deposit.sol";
import { EventUtils } from "../interfaces/gmx/EventUtils.sol";

import { IWithdrawalCallbackReceiver } from "../interfaces/gmx/IWithdrawalCallbackReceiver.sol";
import { Withdrawal } from "../interfaces/gmx/Withdrawal.sol";

import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IIsolationModeTokenVaultV1 } from "../interfaces/IIsolationModeTokenVaultV1.sol";
import { IGmxRegistryV2 } from "./GmxRegistryV2.sol";
import { IsolationModeTokenVaultV1 } from "../proxies/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithPausable } from "../proxies/abstract/IsolationModeTokenVaultV1WithPausable.sol";


/**
 * @title   GmxV2IsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the 
 *          Eth-Usdc GMX Market token that can be used to credit a user's Dolomite balance.
 */
contract GmxV2IsolationModeTokenVaultV1 is IsolationModeTokenVaultV1WithPausable, IDepositCallbackReceiver, IWithdrawalCallbackReceiver {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GmxV2IsolationModeVaultV1";

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function initiateWrapping() external nonReentrant onlyVaultOwner(msg.sender) {
        // freeze vault

        // mint virtual GM tokens based on minimum market tokens value
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external {
        // adjust virtual GM token amount based on actual amount returned

        // unfreeze vault
    }

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external {
        // burn the virtual GM tokens that were intially set

        // unfreeze vault
    }

    function initiateWithdrawal() external nonReentrant onlyVaultOwner(msg.sender) {

    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external {

    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external {

    }

    function registry() public view returns (IGmxRegistryV2) {
        return IGmxRegistryV2(address(0));
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function isExternalRedemptionPaused() public override view returns (bool) {
        return true;
    }
}