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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IBeraRewardVault } from "./interfaces/IBeraRewardVault.sol";
import { IBerachainRewardsIsolationModeTokenVaultV1 } from "./interfaces/IBerachainRewardsIsolationModeTokenVaultV1.sol";
import { IBerachainRewardsIsolationModeVaultFactory } from "./interfaces/IBerachainRewardsIsolationModeVaultFactory.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title   BerachainRewardsIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract BerachainRewardsIsolationModeTokenVaultV1 is
    IBerachainRewardsIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1
{
    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "BerachainRewardsUserVaultV1";

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function stake(uint256 _amount) public onlyVaultOwner(msg.sender) {
        IBeraRewardVault rewardVault = registry().rewardVault();

        IERC20(UNDERLYING_TOKEN()).approve(address(rewardVault), _amount);
        rewardVault.stake(_amount);
    }

    function withdraw(uint256 _amount) public onlyVaultOwner(msg.sender) {
        IBeraRewardVault rewardVault = registry().rewardVault();

        rewardVault.withdraw(_amount);
    }

    function registry() public view returns (IBerachainRewardsRegistry) {
        return IBerachainRewardsIsolationModeVaultFactory(VAULT_FACTORY()).berachainRewardsRegistry();
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

}
