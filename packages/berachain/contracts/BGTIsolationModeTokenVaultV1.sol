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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBerachainRewardsIsolationModeVaultFactory } from "./interfaces/IBerachainRewardsIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IBerachainRewardsMetavault } from "./interfaces/IBerachainRewardsMetavault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


/**
 * @title   BGTIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the BGT token
 *          that can be used to credit a user's Dolomite balance. BGT held in the vault is considered to be in isolation
 *          mode - that is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held
 *          in the same position as other "isolated" tokens.
 */
contract BGTIsolationModeTokenVaultV1 is
    IsolationModeTokenVaultV1
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "BGTIsolationModeTokenVaultV1";

    function executeDepositIntoVault(
        address _from,
        uint256 /* _amount */
    )
    public
    override
    onlyVaultFactory(msg.sender) {
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        IBerachainRewardsMetavault metavault = IBerachainRewardsMetavault(registry().getAccountToMetavault(OWNER()));
        metavault.withdrawBGTAndRedeem(_recipient, _amount);
        assert(_recipient != address(address(this)));
        IERC20(UNDERLYING_TOKEN()).safeTransferFrom(address(metavault), _recipient, _amount);
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
    // ======================== Internal Functions ========================
    // ==================================================================

    function _depositIntoVaultForDolomiteMargin(
        uint256 /* _toAccountNumber */,
        uint256 /* _amountWei */
    ) internal override {
        revert('not implemented');
    }
}
