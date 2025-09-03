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
import { IsolationModeTokenVaultV1WithPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithPausable.sol"; // solhint-disable-line max-line-length
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IMNTIsolationModeTokenVaultV1 } from "./interfaces/IMNTIsolationModeTokenVaultV1.sol";
import { IMNTIsolationModeVaultFactory } from "./interfaces/IMNTIsolationModeVaultFactory.sol";
import { IMNTRegistry } from "./interfaces/IMNTRegistry.sol";
import { IMantleRewardStation } from "./interfaces/IMantleRewardStation.sol";


/**
 * @title   MNTIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract MNTIsolationModeTokenVaultV1 is
    IMNTIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithPausable
{
    using Address for address payable;
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    // solhint-disable max-line-length
    bytes32 private constant _FILE = "MNTIsolationModeTokenVaultV1";
    bytes32 private constant _LAST_STAKE_TIMESTAMP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.lastStakeTimestamp")) - 1);
    bytes32 private constant _IS_CURRENCY_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isCurrencyTransfer")) - 1);
    // solhint-enable max-line-length

    uint256 public constant STAKE_ADDITIONAL_COOLDOWN = 45 seconds;

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    receive() external payable {
        // This needs to be left empty because WMNT calls `transfer` which doesn't pass enough gas for real checks
    }

    function depositPayableIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber
    )
    external
    payable
    nonReentrant
    onlyVaultOwner(msg.sender) {
        _setIsCurrencyTransfer(/* _isCurrencyTransfer = */ true);
        IWETH(UNDERLYING_TOKEN()).deposit{value: msg.value}();
        _depositIntoVaultForDolomiteMargin(_toAccountNumber, msg.value, /* _isViaRouter */ false);
        assert(!isCurrencyTransfer());
    }

    function withdrawPayableFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    external
    nonReentrant
    onlyVaultOwner(msg.sender) {
        _setIsCurrencyTransfer(/* _isCurrencyTransfer = */ true);
        _withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei, /* _isViaRouter */ false);
        assert(!isCurrencyTransfer());
    }

    function stake(
        uint256 _amount
    )
    external
    nonReentrant
    onlyVaultOwner(msg.sender) {
        _stake(_amount);
    }

    function unstake(
        uint256 _amount
    )
    external
    nonReentrant
    onlyVaultOwner(msg.sender) {
        _unstake(_amount);
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        if (isCurrencyTransfer()) {
            _setIsCurrencyTransfer(/* _isCurrencyTransfer = */ false);
        } else {
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
        }
        _stake(_amount);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        uint256 unstakedBalance = super.underlyingBalanceOf();
        if (unstakedBalance < _amount) {
            _unstake(_amount - unstakedBalance);
        }

        assert(_recipient != address(this));
        if (isCurrencyTransfer()) {
            _setIsCurrencyTransfer(/* _isCurrencyTransfer = */ false);
            IWETH(UNDERLYING_TOKEN()).withdraw(_amount);
            payable(_recipient).sendValue(_amount);
        } else {
            IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
        }
    }

    function underlyingBalanceOf() public override virtual view returns (uint256) {
        return super.underlyingBalanceOf() + stakedBalance();
    }

    function stakedBalance() public view returns (uint256) {
        return registry().mantleRewardStation().deposited(address(this));
    }

    function registry() public view returns (IMNTRegistry) {
        return IMNTIsolationModeVaultFactory(VAULT_FACTORY()).mntRegistry();
    }

    function lastStakeTimestamp() public view returns (uint256) {
        return _getUint256(_LAST_STAKE_TIMESTAMP_SLOT);
    }

    function isCurrencyTransfer() public view returns (bool) {
        return _getUint256(_IS_CURRENCY_TRANSFER_SLOT) == 1;
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
        return registry().mantleRewardStation().pauser().isStakingPaused();
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function _stake(uint256 _amount) internal {
        IMantleRewardStation station = registry().mantleRewardStation();

        if (_amount < station.minStake()) {
            return;
        }

        (bool isCoolingDown,) = station.userStakeCooldown(address(this));
        if (isCoolingDown) {
            return;
        }

        if (block.timestamp < STAKE_ADDITIONAL_COOLDOWN + station.cooldown() + lastStakeTimestamp()) {
            return;
        }

        IWETH(UNDERLYING_TOKEN()).withdraw(_amount);
        station.deposit{value: _amount}(_amount);
        _setLastStakeTimestamp(block.timestamp);
    }

    function _unstake(uint256 _amount) internal {
        IMantleRewardStation station = registry().mantleRewardStation();

        (bool isCoolingDown,) = station.userStakeCooldown(address(this));
        Require.that(
            !isCoolingDown,
            _FILE,
            "Stake is cooling down"
        );

        station.withdraw(_amount, /* _receiver = */ address(this));
        IWETH(UNDERLYING_TOKEN()).deposit{value: _amount}();
    }

    function _setLastStakeTimestamp(uint256 _blockTimestamp) internal {
        _setUint256(_LAST_STAKE_TIMESTAMP_SLOT, _blockTimestamp);
        emit LastStakeTimestampSet(_blockTimestamp);
    }

    function _setIsCurrencyTransfer(bool _isCurrencyTransfer) internal {
        _setUint256(_IS_CURRENCY_TRANSFER_SLOT, _isCurrencyTransfer ? 1 : 0);
        emit IsCurrencyTransferSet(_isCurrencyTransfer);
    }
}
