// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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
import { IBerachainRewardsIsolationModeVaultFactory } from "./interfaces/IBerachainRewardsIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IPOLIsolationModeTokenVaultV1 } from "./interfaces/IPOLIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length


/**
 * @title   POLIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds a Berachain underlying reward
 *          token that can be used to credit a user's Dolomite balance. The token held in the vault is considered
 *          to be in isolation mode - that is it cannot be borrowed by other users, may only be seized via
 *          liquidation, and cannot be held in the same position as other "isolated" tokens.
 */
contract POLIsolationModeTokenVaultV1 is
    IPOLIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "POLIsolationModeTokenVaultV1";

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function stake(
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyVaultOwner(msg.sender) {
        _stake(UNDERLYING_TOKEN(), _type, _amount);
    }

    function unstake(
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyVaultOwner(msg.sender) {
        _unstake(UNDERLYING_TOKEN(), _type, _amount);
    }

    function exit() external onlyVaultOwner(msg.sender) {
        _exit(UNDERLYING_TOKEN());
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        // NO-OP
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
    onlyVaultFactory(msg.sender) {
        // NO-OP
    }

    // ==================================================================
    // ======================== View Functions ==========================
    // ==================================================================

    function underlyingBalanceOf()
        public
        override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
        view
        returns (uint256)
    {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        IBerachainRewardsRegistry.RewardVaultType defaultType = metaVault.getDefaultRewardVaultTypeByAsset(
            UNDERLYING_TOKEN()
        );
        return IERC20(UNDERLYING_TOKEN()).balanceOf(address(metaVault)) + metaVault.getStakedBalanceByAssetAndType(UNDERLYING_TOKEN(), defaultType);
    }

    function registry() public view returns (IBerachainRewardsRegistry) {
        return IBerachainRewardsIsolationModeVaultFactory(VAULT_FACTORY()).berachainRewardsRegistry();
    }

    function dolomiteRegistry()
        public
        override(IIsolationModeTokenVaultV1, IsolationModeTokenVaultV1)
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    // @todo add deposit and withdraw internal functions and revert on them

    function _stake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 _amount) internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        IERC20(_asset).safeApprove(address(metaVault), _amount);
        metaVault.stake(_asset, _type, _amount);
    }

    function _unstake(address _asset, IBerachainRewardsRegistry.RewardVaultType _type, uint256 _amount) internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.unstake(_asset, _type, _amount);
    }

    function _exit(address _asset) internal {
        IBerachainRewardsMetaVault metaVault = IBerachainRewardsMetaVault(
            registry().getMetaVaultByVault(address(this))
        );
        metaVault.exit(_asset);
    }

    function _depositIntoVaultForDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) internal override {
        revert("Not implemented");
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) internal override {
        revert("Not implemented");
    }
}
