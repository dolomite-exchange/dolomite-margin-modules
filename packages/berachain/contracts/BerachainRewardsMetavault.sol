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
import { IBGT } from "./interfaces/IBGT.sol";
import { IBerachainRewardsMetavault } from "./interfaces/IBerachainRewardsMetavault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredRewardVault } from "./interfaces/IInfraredRewardVault.sol";
import { INativeRewardVault } from "./interfaces/INativeRewardVault.sol";


/**
 * @title   BerachainRewardsMetavault
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the underlying berachain rewards
 *          tokens that can be used to credit a user's Dolomite balance. GMX held in the vault is considered to be in
 *          isolation mode - that is it cannot be borrowed by other users, may only be seized via liquidation, and
 *          cannot be held in the same position as other "isolated" tokens.
 */
contract BerachainRewardsMetavault is ProxyContractHelpers, IBerachainRewardsMetavault {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "BerachainRewardsMetavault";
    bytes32 private constant _REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.registry")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);
    bytes32 private constant _VALIDATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.validator")) - 1);

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyChildVault(address _sender) {
        Require.that(
            REGISTRY().getVaultToMetavault(_sender) == address(this),
            _FILE,
            "Only child vault can call",
            _sender
        );
        _;
    }

    modifier onlyMetavaultOwner(address _sender) {
        Require.that(
            OWNER() == _sender,
            _FILE,
            "Only owner can call",
            _sender
        );
        _;
    }

    modifier onlyActiveValidator(address _validator) {
        Require.that(
            validator() == _validator,
            _FILE,
            "Does not match active validator"
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
        IBerachainRewardsRegistry rewardRegistry = REGISTRY();
        INativeRewardVault rewardVault = INativeRewardVault(rewardRegistry.rewardVault(_asset, _type));
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
        INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));
        rewardVault.withdraw(_amount);
        IERC20(_asset).approve(msg.sender, _amount);
    }

    function getReward(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyMetavaultOwner(msg.sender) returns (uint256) {
        if (_type == IBerachainRewardsRegistry.RewardVaultType.NATIVE) {
            INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));
            uint256 bgtAmount = rewardVault.getReward(address(this));
            REGISTRY().bgtIsolationModeVaultFactory().depositIntoDolomiteMarginFromMetavault(
                OWNER(),
                0,
                bgtAmount
            );
            return bgtAmount;
        } else {
            IInfraredRewardVault rewardVault = IInfraredRewardVault(REGISTRY().rewardVault(_asset, _type));
            rewardVault.getReward();
            // @follow-up Should we get balance to return it?
            // @todo Yes, get bal before and then diff
            _depositIBGTIntoDolomite();
        }
    }

    function exit(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyChildVault(msg.sender) {
        INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));
        IBGT bgt = REGISTRY().bgt();

        uint256 preBal = bgt.balanceOf(address(this));
        rewardVault.exit();
        uint256 postBal = bgt.balanceOf(address(this));
        if (postBal - preBal > 0) {
            REGISTRY().bgtIsolationModeVaultFactory().depositIntoDolomiteMarginFromMetavault(
                OWNER(),
                0,
                postBal - preBal
            );
        }

        uint256 bal = IERC20(_asset).balanceOf(address(this));
        assert(bal > 0);
        IERC20(_asset).safeApprove(msg.sender, bal);

        if (_type == IBerachainRewardsRegistry.RewardVaultType.INFRARED) {
            _depositIBGTIntoDolomite();
        }
    }

    // ==================================================================
    // ======================== BGT Functions ===========================
    // ==================================================================

    function delegateBGT(address _delgatee) external onlyMetavaultOwner(msg.sender) {
        REGISTRY().bgt().delegate(_delgatee);
    }

    function queueBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetavaultOwner(msg.sender) {
        address currentValidator = validator();
        if (currentValidator == address(0)) {
            _setAddress(_VALIDATOR_SLOT, _validator);
            emit ValidatorSet(_validator);
        } else {
            Require.that(
                currentValidator == _validator,
                _FILE,
                "Does not match active validator"
            );
        }
        REGISTRY().bgt().queueBoost(_validator, _amount);
    }

    function activateBGTBoost(
        address _validator
    ) external onlyMetavaultOwner(msg.sender) onlyActiveValidator(_validator) {
        // @todo add view to see how many blocks until can call activate
        // @todo add tests to see about adding more queued balance
        REGISTRY().bgt().activateBoost(_validator);
    }

    function cancelBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetavaultOwner(msg.sender) onlyActiveValidator(_validator) {
        IBGT bgt = REGISTRY().bgt();
        bgt.cancelBoost(_validator, _amount);
        _resetValidatorIfEmptyBoosts(bgt);
    }

    function dropBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetavaultOwner(msg.sender) onlyActiveValidator(_validator) {
        IBGT bgt = REGISTRY().bgt();
        bgt.dropBoost(_validator, _amount);
        _resetValidatorIfEmptyBoosts(bgt);
    }

    function withdrawBGTAndRedeem(
        address _recipient,
        uint256 _amount
    ) external {
        Require.that(
            REGISTRY().bgtIsolationModeVaultFactory().getVaultByAccount(OWNER()) == msg.sender,
            _FILE,
            "Not child BGT vault"
        );

        // @audit check safecasting with uint128 and uint256
        IBGT bgt = REGISTRY().bgt();
        uint256 unboostedBal = bgt.unboostedBalanceOf(address(this));
        if (_amount > unboostedBal) {
            uint128 queuedBoost = bgt.queuedBoost(address(this));
            uint128 diff = uint128(_amount - unboostedBal);

            if (queuedBoost >= diff) {
                bgt.cancelBoost(validator(), uint128(_amount - unboostedBal));
            } else {
                bgt.cancelBoost(validator(), queuedBoost);
                bgt.dropBoost(validator(), diff - queuedBoost);
            }
        }
        
        _resetValidatorIfEmptyBoosts(bgt);
        bgt.redeem(_recipient, _amount);
    }

    // ==================================================================
    // ======================== View Functions ==========================
    // ==================================================================

    function REGISTRY() public view returns (IBerachainRewardsRegistry) {
        return IBerachainRewardsRegistry(_getAddress(_REGISTRY_SLOT));
    }

    function OWNER() public view returns (address) {
        return _getAddress(_OWNER_SLOT);
    }

    function validator() public view returns (address) {
        return _getAddress(_VALIDATOR_SLOT);
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    function _depositIBGTIntoDolomite() internal {
        IBerachainRewardsRegistry beraRegistry = REGISTRY();
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

    function _resetValidatorIfEmptyBoosts(IBGT _bgt) internal {
        uint128 queuedBoost = _bgt.queuedBoost(address(this));
        uint128 boosts = _bgt.boosts(address(this));
        if (queuedBoost == 0 && boosts == 0) {
            _setAddress(_VALIDATOR_SLOT, address(0));
        }
        emit ValidatorSet(address(0));
    }
}
