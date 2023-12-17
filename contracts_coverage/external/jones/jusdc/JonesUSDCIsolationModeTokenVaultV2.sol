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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { IDolomiteRegistry } from "../../interfaces/IDolomiteRegistry.sol";
import { IJonesUSDCFarm } from "../../interfaces/jones/IJonesUSDCFarm.sol";
import { IJonesUSDCIsolationModeVaultFactory } from "../../interfaces/jones/IJonesUSDCIsolationModeVaultFactory.sol";
import { IJonesUSDCRegistry } from "../../interfaces/jones/IJonesUSDCRegistry.sol";
import { IJonesWhitelistController } from "../../interfaces/jones/IJonesWhitelistController.sol";
import { IsolationModeTokenVaultV1 } from "../../proxies/abstract/IsolationModeTokenVaultV1.sol";
import { JonesUSDCIsolationModeTokenVaultV1 } from "./JonesUSDCIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length


/**
 * @title   JonesUSDCIsolationModeTokenVaultV2
 * @author  Dolomite
 *
 * @notice  A subclass of JonesUSDCIsolationModeTokenVaultV1 which enables jUSDC farming
 */
contract JonesUSDCIsolationModeTokenVaultV2 is JonesUSDCIsolationModeTokenVaultV1 {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "JonesUSDCIsolationModeVaultV2";
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _JUSDC_POOL_ID = 1;
    uint256 private constant _DEPOSIT_INCENTIVE_PRECISION = 1e12;
    uint256 private constant _ARB_MARKET_ID = 7;
    address private constant _ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    bytes32 private constant _SHOULD_WITHDRAW_TO_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldWithdrawToVault")) - 1); // solhint-disable-line max-line-length

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function stake(uint256 _amount) public onlyVaultOwner(msg.sender) {
        IJonesUSDCFarm farm = registry().jUSDCFarm();

        IJonesUSDCFarm.PoolInfo memory pool = farm.poolInfo(_JUSDC_POOL_ID);
        if (farm.incentivesOn() && farm.incentiveReceiver() != address(0) && pool.depositIncentives != 0) {
            uint256 incentive = _amount * pool.depositIncentives / _DEPOSIT_INCENTIVE_PRECISION;
            _setShouldWithdrawToVault(/* _shouldWithdrawToVault = */ true);
            _withdrawFromVaultForDolomiteMargin(_DEFAULT_ACCOUNT_NUMBER, incentive);
        }
        IERC20(UNDERLYING_TOKEN()).safeApprove(address(farm), _amount);
        farm.deposit(
            _JUSDC_POOL_ID,
            _amount,
            /* _to = */ address(this)
        );
    }

    function unstake(uint256 _amount) public onlyVaultOwner(msg.sender) {
        IJonesUSDCFarm farm = registry().jUSDCFarm();
        farm.withdraw(
            _JUSDC_POOL_ID,
            _amount,
            /* _to = */ address(this)
        );
        _harvestRewardsAndSweepIntoDolomiteMargin();
    }

    function harvestRewards() public onlyVaultOwner(msg.sender) {
        _harvestRewardsAndSweepIntoDolomiteMargin();
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        /*assert(_recipient != address(this));*/
        uint256 balance = IERC20(UNDERLYING_TOKEN()).balanceOf(address(this));
        if (shouldWithdrawToVault()) {
            if (balance >= _amount) { /* FOR COVERAGE TESTING */ }
            Require.that(
                balance >= _amount,
                _FILE,
                "Insufficient balance"
            );
            _setShouldWithdrawToVault(/* _shouldWithdrawToVault = */ false);
        } else {
            if (balance < _amount) {
                registry().jUSDCFarm().withdraw(_JUSDC_POOL_ID, _amount - balance, /* _to = */ address(this));
            }
            IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
        }
    }

    function shouldWithdrawToVault() public view returns (bool) {
        return _getUint256(_SHOULD_WITHDRAW_TO_VAULT_SLOT) == 1;
    }

    function pendingRewards() public view returns (uint256) {
        return registry().jUSDCFarm().pendingSushi(_JUSDC_POOL_ID, address(this));
    }

    function stakedBalanceOf() public view returns (uint256) {
        return registry().jUSDCFarm().userInfo(_JUSDC_POOL_ID, address(this)).amount;
    }

    function underlyingBalanceOf() public override view returns (uint256) {
        return super.underlyingBalanceOf() + stakedBalanceOf();
    }

    // ================================================================
    // ======================= Internal Functions =====================
    // ================================================================

    function _harvestRewardsAndSweepIntoDolomiteMargin() internal {
        IJonesUSDCFarm farm = registry().jUSDCFarm();
        farm.harvest(_JUSDC_POOL_ID, /* _to = */ address(this));
        _sweepRewardsIntoDolomiteMargin();
    }

    function _sweepRewardsIntoDolomiteMargin() internal {
        uint256 balance = IERC20(_ARB).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_ARB).safeApprove(address(DOLOMITE_MARGIN()), balance);
            IJonesUSDCIsolationModeVaultFactory(VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                _DEFAULT_ACCOUNT_NUMBER,
                _ARB_MARKET_ID,
                balance
            );
        }
    }

    function _setShouldWithdrawToVault(bool _shouldWithdrawToVault) internal {
        _setUint256(_SHOULD_WITHDRAW_TO_VAULT_SLOT, _shouldWithdrawToVault ? 1 : 0);
    }
}
