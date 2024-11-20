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
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IBGT } from "./interfaces/IBGT.sol";
import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredRewardVault } from "./interfaces/IInfraredRewardVault.sol";
import { IMetaVaultRewardReceiver } from "./interfaces/IMetaVaultRewardReceiver.sol";
import { IMetaVaultRewardTokenFactory } from "./interfaces/IMetaVaultRewardTokenFactory.sol";
import { INativeRewardVault } from "./interfaces/INativeRewardVault.sol";


/**
 * @title   BerachainRewardsMetaVault
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the underlying berachain rewards
 *          tokens that can be used to credit a user's Dolomite balance. Tokens held in the vault are considered
 *          to be in isolation mode - that is it cannot be borrowed by other users, may only be seized via
 *          liquidation, and cannot be held in the same position as other "isolated" tokens.
 */
contract BerachainRewardsMetaVault is ProxyContractHelpers, IBerachainRewardsMetaVault {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "BerachainRewardsMetaVault";
    bytes32 private constant _REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.registry")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);
    bytes32 private constant _VALIDATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.validator")) - 1);

    /// @dev This variable is hardcoded here because it's private in the BGT contract
    uint256 public constant HISTORY_BUFFER_LENGTH = 8191;
    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyChildVault(address _sender) {
        _requireOnlyChildVault(_sender);
        _;
    }

    modifier onlyMetaVaultOwner(address _sender) {
        _requireOnlyMetaVaultOwner(_sender);
        _;
    }

    modifier onlyActiveValidator(address _validator) {
        _requireActiveValidator(_validator);
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
        IERC20(_asset).safeApprove(address(rewardVault), _amount);
        rewardVault.stake(_amount);
    }

    function unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));
        rewardVault.withdraw(_amount);
        IERC20(_asset).safeTransfer(msg.sender, _amount);
    }

    function getReward(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyMetaVaultOwner(msg.sender) returns (uint256) {
        address rewardVault = REGISTRY().rewardVault(_asset, _type);
        IMetaVaultRewardTokenFactory factory;
        uint256 reward;

        if (_type == IBerachainRewardsRegistry.RewardVaultType.NATIVE) {
            reward = INativeRewardVault(rewardVault).getReward(address(this));
            factory = REGISTRY().bgtIsolationModeVaultFactory();
        } else {
            assert(_type == IBerachainRewardsRegistry.RewardVaultType.INFRARED);
            factory = REGISTRY().iBgtIsolationModeVaultFactory();
            IERC20 iBgt = REGISTRY().iBgt();

            uint256 balanceBefore = iBgt.balanceOf(address(this));
            IInfraredRewardVault(rewardVault).getReward();
            reward = iBgt.balanceOf(address(this)) - balanceBefore;
        }

        if (reward > 0) {
            _performDepositRewardByRewardType(factory, _type, reward);
        }

        return reward;
    }

    function exit(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyChildVault(msg.sender) {
        INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));
        IERC20 token;
        IMetaVaultRewardTokenFactory factory;
        if (_type == IBerachainRewardsRegistry.RewardVaultType.NATIVE) {
            token = REGISTRY().bgt();
            factory = REGISTRY().bgtIsolationModeVaultFactory();
        } else {
            token = REGISTRY().iBgt();
            factory = REGISTRY().iBgtIsolationModeVaultFactory();
        }

        uint256 balanceBefore = token.balanceOf(address(this));
        rewardVault.exit();

        uint256 balance = IERC20(_asset).balanceOf(address(this));
        assert(balance > 0);
        IERC20(_asset).safeTransfer(msg.sender, balance);

        uint256 reward = token.balanceOf(address(this)) - balanceBefore;
        if (reward > 0) {
            _performDepositRewardByRewardType(factory, _type, reward);
        }

    }

    // ==================================================================
    // ======================== BGT Functions ===========================
    // ==================================================================

    function delegateBGT(address _delgatee) external onlyMetaVaultOwner(msg.sender) {
        REGISTRY().bgt().delegate(_delgatee);
    }

    function queueBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetaVaultOwner(msg.sender) {
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
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveValidator(_validator) {
        Require.that(
            REGISTRY().bgt().boostedQueue(address(this), validator()).blockNumberLast != 0,
            _FILE,
            "No queued boost to activate"
        );

        REGISTRY().bgt().activateBoost(_validator);
    }

    function cancelBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveValidator(_validator) {
        IBGT bgt = REGISTRY().bgt();
        bgt.cancelBoost(_validator, _amount);
        _resetValidatorIfEmptyBoosts(bgt);
    }

    function dropBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveValidator(_validator) {
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

        IBGT bgt = REGISTRY().bgt();
        uint256 unboostedBalance = bgt.unboostedBalanceOf(address(this));
        if (_amount > unboostedBalance) {
            uint128 queuedBoost = bgt.queuedBoost(address(this));
            uint128 diff = SafeCast.toUint128(_amount - unboostedBalance);

            if (queuedBoost >= diff) {
                bgt.cancelBoost(validator(), diff);
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

    function blocksToActivateBoost() external view returns (uint256) {
        uint256 blockNumberLast = REGISTRY().bgt().boostedQueue(address(this), validator()).blockNumberLast;
        if (blockNumberLast == 0) {
            return 0;
        }

        if (block.number - blockNumberLast >= HISTORY_BUFFER_LENGTH) {
            return 0;
        } else {
            return HISTORY_BUFFER_LENGTH - (block.number - blockNumberLast);
        }
    }

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
    // ======================== Internal Functions ======================
    // ==================================================================

    function _resetValidatorIfEmptyBoosts(IBGT _bgt) internal {
        uint128 queuedBoost = _bgt.queuedBoost(address(this));
        uint128 boosts = _bgt.boosts(address(this));
        if (queuedBoost == 0 && boosts == 0 && validator() != address(0)) {
            _setAddress(_VALIDATOR_SLOT, address(0));
            emit ValidatorSet(address(0));
        }
    }

    function _performDepositRewardByRewardType(
        IMetaVaultRewardTokenFactory _factory,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _reward
    ) internal {
        address vault = _factory.getVaultByAccount(OWNER());
        if (vault == address(0)) {
            vault = _factory.createVault(OWNER());
        }

        if (_type == IBerachainRewardsRegistry.RewardVaultType.INFRARED) {
            IERC20(REGISTRY().iBgt()).safeApprove(vault, _reward);
        }

        IMetaVaultRewardReceiver(vault).setIsDepositSourceMetaVault(true);
        _factory.depositIntoDolomiteMarginFromMetaVault(
            OWNER(),
            DEFAULT_ACCOUNT_NUMBER,
            _reward
        );

        assert(!IMetaVaultRewardReceiver(vault).isDepositSourceMetaVault());
        if (_type == IBerachainRewardsRegistry.RewardVaultType.INFRARED) {
            // Check the allowance was spent
            assert(IERC20(REGISTRY().iBgt()).allowance(vault, address(this)) == 0);
        }
    }

    function _requireOnlyChildVault(address _sender) internal view {
        Require.that(
            REGISTRY().getMetaVaultByVault(_sender) == address(this),
            _FILE,
            "Only child vault can call",
            _sender
        );
    }

    function _requireOnlyMetaVaultOwner(address _sender) internal view {
        Require.that(
            OWNER() == _sender,
            _FILE,
            "Only owner can call",
            _sender
        );
    }

    function _requireActiveValidator(address _validator) internal view {
        Require.that(
            validator() == _validator,
            _FILE,
            "Does not match active validator"
        );
    }
}
