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
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MetaVaultRewardReceiver } from "./MetaVaultRewardReceiver.sol";
import { IInfraredBGTIsolationModeTokenVaultV1 } from "./interfaces/IInfraredBGTIsolationModeTokenVaultV1.sol";
import { IInfraredVault } from "./interfaces/IInfraredVault.sol";


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
    bytes32 private constant _IS_DEPOSIT_SOURCE_THIS_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceThisVault")) - 1); // solhint-disable-line max-line-length

    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;

    // ==================================================================
    // =========================== Functions ============================
    // ==================================================================

    function stake(uint256 _amount) external onlyVaultOwner(msg.sender) {
        _stake(_amount);
    }

    function unstake(uint256 _amount) external onlyVaultOwner(msg.sender) {
        _unstake(_amount);
    }

    function getReward() external onlyVaultOwner(msg.sender) {
        _getReward();
    }

    function exit() external onlyVaultOwner(msg.sender) {
        _exit();
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        if (isDepositSourceMetaVault()) {
            address metaVault = registry().getMetaVaultByVault(address(this));
            assert(metaVault != address(0));

            _setIsDepositSourceMetaVault(false);
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(metaVault, address(this), _amount);
        } else if (isDepositSourceThisVault()) {
            _setIsDepositSourceThisVault(false);
            assert(IERC20(UNDERLYING_TOKEN()).balanceOf(address(this)) >= _amount);
        } else {
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
        }

        // TODO: check if it's paused here or not and continue processing
        _stake(_amount);
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

        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function underlyingBalanceOf()
        public
        view
        override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
        returns (uint256)
    {
        return super.underlyingBalanceOf() + registry().iBgtStakingVault().balanceOf(address(this));
    }

    function isDepositSourceThisVault() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_THIS_VAULT_SLOT) == 1;
    }

    function dolomiteRegistry()
        public
        override(IsolationModeTokenVaultV1, IIsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function _stake(uint256 _amount) internal {
        IInfraredVault vault = registry().iBgtStakingVault();
        IERC20(UNDERLYING_TOKEN()).safeApprove(address(vault), _amount);
        vault.stake(_amount);
    }

    function _unstake(uint256 _amount) internal {
        IInfraredVault vault = registry().iBgtStakingVault();
        vault.withdraw(_amount);
    }

    function _getReward() internal {
        IInfraredVault vault = registry().iBgtStakingVault();

        IInfraredVault.UserReward[] memory rewards = vault.getAllRewardsForUser(address(this));
        vault.getReward();

        _handleRewards(rewards);
    }

    function _exit() internal {
        IInfraredVault vault = registry().iBgtStakingVault();

        IInfraredVault.UserReward[] memory rewards = vault.getAllRewardsForUser(address(this));
        vault.exit();

        _handleRewards(rewards);

        for (uint256 i = 0; i < rewards.length; ++i) {
            if (rewards[i].amount > 0 && rewards[i].token == UNDERLYING_TOKEN() && !vault.paused()) {
                _unstake(rewards[i].amount);
            }
        }
    }

    function _setIsDepositSourceThisVault(bool _isDepositSourceThisVault) internal {
        _setUint256(_IS_DEPOSIT_SOURCE_THIS_VAULT_SLOT, _isDepositSourceThisVault ? 1 : 0);
        emit IsDepositSourceThisVaultSet(_isDepositSourceThisVault);
    }

    function _handleRewards(IInfraredVault.UserReward[] memory _rewards) internal {
        IIsolationModeVaultFactory factory = IIsolationModeVaultFactory(VAULT_FACTORY());
        for (uint256 i = 0; i < _rewards.length; ++i) {
            if (_rewards[i].amount > 0) {
                if (_rewards[i].token == UNDERLYING_TOKEN()) {
                    _setIsDepositSourceThisVault(true);
                    factory.depositIntoDolomiteMargin(
                        DEFAULT_ACCOUNT_NUMBER,
                        _rewards[i].amount
                    );
                    assert(!isDepositSourceThisVault());
                } else {
                    try DOLOMITE_MARGIN().getMarketIdByTokenAddress(_rewards[i].token) returns (uint256 marketId) {
                        IERC20(_rewards[i].token).safeApprove(address(DOLOMITE_MARGIN()), _rewards[i].amount);
                        try factory.depositOtherTokenIntoDolomiteMarginForVaultOwner(
                            DEFAULT_ACCOUNT_NUMBER,
                            marketId,
                            _rewards[i].amount
                        ) {} catch {
                            IERC20(_rewards[i].token).safeApprove(address(DOLOMITE_MARGIN()), 0);
                            IERC20(_rewards[i].token).safeTransfer(OWNER(), _rewards[i].amount);
                        }
                    } catch {
                        IERC20(_rewards[i].token).safeTransfer(OWNER(), _rewards[i].amount);
                    }
                }
            }
        }
    }
}
