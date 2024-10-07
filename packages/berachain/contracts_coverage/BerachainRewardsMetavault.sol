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

import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBeraRewardVault } from "./interfaces/IBeraRewardVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredVault } from "./interfaces/IInfraredVault.sol";


/**
 * @title   BerachainRewardsMetavault
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract BerachainRewardsMetavault is ProxyContractHelpers {
    using SafeERC20 for IERC20;
    // @todo fix comments above

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "BerachainRewardsMetavault";
    bytes32 private constant _REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.registry")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyChildVault(address _sender) {
        if (registry().getVaultToMetavault(_sender) == address(this)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            registry().getVaultToMetavault(_sender) == address(this),
            _FILE,
            "Only child vault can call",
            _sender
        );
        _;
    }

    modifier onlyMetavaultOwner(address _sender) {
        if (OWNER() == _sender) { /* FOR COVERAGE TESTING */ }
        Require.that(
            OWNER() == _sender,
            _FILE,
            "Only owner can call",
            _sender
        );
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function stake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        IBerachainRewardsRegistry rewardRegistry = registry();
        IBeraRewardVault rewardVault = IBeraRewardVault(rewardRegistry.rewardVault(_asset, _type));
        IBerachainRewardsRegistry.RewardVaultType _defaultType = rewardRegistry.getAccountToAssetToDefaultType(
            OWNER(),
            _asset
        );

        if (_defaultType != _type) {
            rewardRegistry.setAccountToAssetToDefaultType(_asset, _type);
        }

        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_asset).approve(address(rewardVault), _amount);
        rewardVault.stake(_amount);
    }

    function unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        IBeraRewardVault rewardVault = IBeraRewardVault(registry().rewardVault(_asset, _type));
        rewardVault.withdraw(_amount);
        IERC20(_asset).approve(msg.sender, _amount);
    }

    function getReward(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyMetavaultOwner(msg.sender) returns (uint256) {
        if (_type == IBerachainRewardsRegistry.RewardVaultType.NATIVE) {
            IBeraRewardVault rewardVault = IBeraRewardVault(registry().rewardVault(_asset, _type));
            return rewardVault.getReward(address(this));
        } else {
            IInfraredVault rewardVault = IInfraredVault(registry().rewardVault(_asset, _type));
            rewardVault.getReward();
            // @follow-up Should we get balance to return it?
            _depositIBGTIntoDolomite();
        }
    }

    function exit(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyChildVault(msg.sender) {
        IBeraRewardVault rewardVault = IBeraRewardVault(registry().rewardVault(_asset, _type));
        rewardVault.exit();

        uint256 bal = IERC20(_asset).balanceOf(address(this));
        /*assert(bal > 0);*/
        IERC20(_asset).safeApprove(msg.sender, bal);

        if (_type == IBerachainRewardsRegistry.RewardVaultType.INFRARED) {
            _depositIBGTIntoDolomite();
        }
    }

    // ==================================================================
    // ======================== BGT Functions ===========================
    // ==================================================================

    // @todo add bgt & ibgt boost functionality

    function redeemBGT(uint256 _amount) external onlyMetavaultOwner(msg.sender) {
        registry().bgt().redeem(OWNER(), _amount);
    }

    function delegateBGT(address _delgatee) external onlyMetavaultOwner(msg.sender) {
        registry().bgt().delegate(_delgatee);
    }

    // ==================================================================
    // ======================== View Functions ==========================
    // ==================================================================

    // @audit same function on proxy
    function registry() public view returns (IBerachainRewardsRegistry) {
        return IBerachainRewardsRegistry(_getAddress(_REGISTRY_SLOT));
    }

    function OWNER() public view returns (address) {
        return _getAddress(_OWNER_SLOT);
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _depositIBGTIntoDolomite() internal {
        IBerachainRewardsRegistry beraRegistry = registry();
        IERC20 iBgt = beraRegistry.iBgt();

        uint256 bal = iBgt.balanceOf(address(this));
        if (bal > 0) {
            iBgt.safeApprove(address(beraRegistry.metavaultOperator()), bal);
            beraRegistry.metavaultOperator().depositIntoUserAccountFromMetavault(
                OWNER(),
                address(iBgt),
                bal
            );
        }
    }
}
