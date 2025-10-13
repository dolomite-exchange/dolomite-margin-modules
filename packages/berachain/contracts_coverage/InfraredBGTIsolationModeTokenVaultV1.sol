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
import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MetaVaultRewardReceiver } from "./MetaVaultRewardReceiver.sol";
import { IBaseMetaVault } from "./interfaces/IBaseMetaVault.sol";
import { IInfraredBGTIsolationModeTokenVaultV1 } from "./interfaces/IInfraredBGTIsolationModeTokenVaultV1.sol";


/**
 * @title   InfraredBGTIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the iBGT token
 *          that can be used to credit a user's Dolomite balance. BGT held in the vault is considered to be in isolation
 *          mode - that is it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held
 *          in the same position as other "isolated" tokens.
 */
contract InfraredBGTIsolationModeTokenVaultV1 is
    MetaVaultRewardReceiver,
    IInfraredBGTIsolationModeTokenVaultV1
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "InfraredBGTUserVaultV1";

    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;

    // ==================================================================
    // ======================= Public Functions =========================
    // ==================================================================

    function stake(uint256 _amount) external onlyVaultOwner(msg.sender) {
        _stake(_amount);
    }

    function unstake(uint256 _amount) external onlyVaultOwner(msg.sender) {
        _unstake(_amount);
    }

    function getReward() external onlyVaultOwner(msg.sender) {
        IBaseMetaVault(_getMetaVault()).getRewardIBgt();
    }

    function exit() external onlyVaultOwner(msg.sender) {
        IBaseMetaVault metaVault = IBaseMetaVault(_getMetaVault());
        metaVault.getRewardIBgt();

        uint256 stakedBalance = registry().iBgtStakingVault().balanceOf(address(metaVault));
        if (stakedBalance > 0) {
            metaVault.unstakeIBgt(stakedBalance);
        }
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        if (isDepositSourceMetaVault()) {
            address metaVault = _getMetaVault();
            /*assert(metaVault != address(0));*/

            _setIsDepositSourceMetaVault(false);
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(metaVault, address(this), _amount);
        } else {
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
        }

        if (!registry().iBgtStakingVault().paused()) {
            _stake(_amount);
        }
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        uint256 unstakedBalance = super.underlyingBalanceOf();
        if (_amount > unstakedBalance) {
            _unstake(_amount - unstakedBalance);
        }

        /*assert(_recipient != address(this));*/
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    // ==================================================================
    // ======================== View Functions ==========================
    // ==================================================================

    function underlyingBalanceOf()
        public
        view
        override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
        returns (uint256)
    {
        return super.underlyingBalanceOf() + registry().iBgtStakingVault().balanceOf(_getMetaVault());
    }

    function dolomiteRegistry()
        public
        override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ======================
    // ==================================================================

    function _stake(uint256 _amount) internal {
        IBaseMetaVault metaVault = IBaseMetaVault(_getMetaVault());
        IERC20(UNDERLYING_TOKEN()).safeApprove(address(metaVault), _amount);
        metaVault.stakeIBgt(_amount);
    }

    function _unstake(uint256 _amount) internal {
        IBaseMetaVault(_getMetaVault()).unstakeIBgt(_amount);
    }

    function _getMetaVault() internal view returns (address) {
        return registry().getMetaVaultByVault(address(this));
    }
}
