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
import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IBGT } from "./interfaces/IBGT.sol";
import { IBGTM } from "./interfaces/IBGTM.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredVault } from "./interfaces/IInfraredVault.sol";
import { IMetaVaultRewardReceiver } from "./interfaces/IMetaVaultRewardReceiver.sol";
import { IMetaVaultRewardTokenFactory } from "./interfaces/IMetaVaultRewardTokenFactory.sol";
import { INativeRewardVault } from "./interfaces/INativeRewardVault.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";


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
    bytes32 private constant _BGT_VALIDATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgtValidator")) - 1);
    bytes32 private constant _BGTM_VALIDATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgtmValidator")) - 1);
    bytes32 private constant _STAKED_BALANCES_SLOT = bytes32(uint256(keccak256("eip1967.proxy.stakedBalances")) - 1);

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

    modifier onlyActiveBgtValidator(address _validator) {
        _requireActiveBgtValidator(_validator);
        _;
    }

    modifier onlyActiveBgtmValidator(address _validator) {
        _requireActiveBgtmValidator(_validator);
        _;
    }

    modifier onlyValidDolomiteToken(address _asset) {
        _requireValidDolomiteToken(_asset);
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================
    receive() external payable {}

    function stakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyValidDolomiteToken(_asset) {
        _stake(_asset, _type, _amount);
    }

    function unstakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyValidDolomiteToken(_asset) {
        _unstake(_asset, _type, _amount);
    }

    function setDefaultRewardVaultTypeByAsset(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyMetaVaultOwner(msg.sender) {
        _setDefaultRewardVaultTypeByAsset(_asset, _type);
    }

    function stake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _stake(_asset, _type, _amount);
    }

    function unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _unstake(_asset, _type, _amount);
    }

    function getReward(
        address _asset
    ) external onlyMetaVaultOwner(msg.sender) returns (uint256) {
        IBerachainRewardsRegistry.RewardVaultType defaultType = getDefaultRewardVaultTypeByAsset(_asset);
        address rewardVault = REGISTRY().rewardVault(_asset, defaultType);
        IMetaVaultRewardTokenFactory factory;
        uint256 reward;

        if (defaultType == IBerachainRewardsRegistry.RewardVaultType.NATIVE) {
            reward = INativeRewardVault(rewardVault).getReward(address(this));
            factory = REGISTRY().bgtIsolationModeVaultFactory();
        } else if (defaultType == IBerachainRewardsRegistry.RewardVaultType.BGTM) {
            reward = INativeRewardVault(rewardVault).earned(address(this));
            REGISTRY().bgtm().deposit(rewardVault);
            factory = REGISTRY().bgtmIsolationModeVaultFactory();
        } else {
            assert(defaultType == IBerachainRewardsRegistry.RewardVaultType.INFRARED);
            factory = REGISTRY().iBgtIsolationModeVaultFactory();
            IERC20 iBgt = REGISTRY().iBgt();

            // @todo may need to adjust Infrared to use the getAllRewardsForUser function
            uint256 balanceBefore = iBgt.balanceOf(address(this));
            IInfraredVault(rewardVault).getReward();
            reward = iBgt.balanceOf(address(this)) - balanceBefore;
        }

        if (reward > 0) {
            _performDepositRewardByRewardType(factory, defaultType, reward);
        }

        return reward;
    }

    function exit(
        address _asset
    ) external onlyChildVault(msg.sender) {
        IBerachainRewardsRegistry.RewardVaultType defaultType = getDefaultRewardVaultTypeByAsset(_asset);
        INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, defaultType));
        IERC20 token;
        IMetaVaultRewardTokenFactory factory;
        if (defaultType == IBerachainRewardsRegistry.RewardVaultType.NATIVE) {
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
            _performDepositRewardByRewardType(factory, defaultType, reward);
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
        address currentValidator = bgtValidator();
        if (currentValidator == address(0)) {
            _setAddress(_BGT_VALIDATOR_SLOT, _validator);
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
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtValidator(_validator) {
        Require.that(
            REGISTRY().bgt().boostedQueue(address(this), bgtValidator()).blockNumberLast != 0,
            _FILE,
            "No queued boost to activate"
        );

        REGISTRY().bgt().activateBoost(_validator);
    }

    function cancelBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtValidator(_validator) {
        IBGT bgt = REGISTRY().bgt();
        bgt.cancelBoost(_validator, _amount);
        _resetBgtValidatorIfEmptyBoosts(bgt);
    }

    function dropBGTBoost(
        address _validator,
        uint128 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtValidator(_validator) {
        IBGT bgt = REGISTRY().bgt();
        bgt.dropBoost(_validator, _amount);
        _resetBgtValidatorIfEmptyBoosts(bgt);
    }

    function delegateBGTM(
        address _validator,
        uint256 _amount
    ) external onlyMetaVaultOwner(msg.sender) {
        address currentValidator = bgtmValidator();
        if (currentValidator == address(0)) {
            _setAddress(_BGTM_VALIDATOR_SLOT, _validator);
            emit ValidatorSet(_validator);
        } else {
            Require.that(
                currentValidator == _validator,
                _FILE,
                "Does not match active validator"
            );
        }

        REGISTRY().bgtm().delegate(_validator, _amount);
        // @note Adds to pending
    }

    function unbondBGTM(
        address _validator,
        uint256 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtmValidator(_validator) {
        REGISTRY().bgtm().unbond(_validator, _amount);
    }

    function activateBgtm(
        address _validator
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtmValidator(_validator) {
        REGISTRY().bgtm().activate(_validator);
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
                bgt.cancelBoost(bgtValidator(), diff);
            } else {
                bgt.cancelBoost(bgtValidator(), queuedBoost);
                bgt.dropBoost(bgtValidator(), diff - queuedBoost);
            }
        }

        _resetBgtValidatorIfEmptyBoosts(bgt);
        bgt.redeem(address(this), _amount);
        IWETH wbera = REGISTRY().wbera();
        wbera.deposit{value: _amount}();
        wbera.transfer(_recipient, _amount);
    }

    function redeemBGTM(
        address _recipient,
        uint256 _amount
    ) external {
        Require.that(
            REGISTRY().bgtmIsolationModeVaultFactory().getVaultByAccount(OWNER()) == msg.sender,
            _FILE,
            "Not child BGTM vault"
        );

        IBGTM bgtm = REGISTRY().bgtm();
        uint256 bal = bgtm.getBalance(address(this));
        if (_amount > bal) {
            // @audit User can block this because of the delay. Need to discuss
            bgtm.unbond(bgtmValidator(), _amount - bal);
        }

        REGISTRY().bgtm().redeem(_amount);
        IWETH wbera = REGISTRY().wbera();
        wbera.deposit{value: _amount}();
        wbera.transfer(_recipient, _amount);
    }

    // ==================================================================
    // ======================== View Functions ==========================
    // ==================================================================

    function blocksToActivateBgtBoost() external view returns (uint256) {
        uint256 blockNumberLast = REGISTRY().bgt().boostedQueue(address(this), bgtValidator()).blockNumberLast;
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

    function bgtValidator() public view returns (address) {
        return _getAddress(_BGT_VALIDATOR_SLOT);
    }

    function bgtmValidator() public view returns (address) {
        return _getAddress(_BGTM_VALIDATOR_SLOT);
    }

    function getDefaultRewardVaultTypeByAsset(
        address _asset
    ) public view override returns (IBerachainRewardsRegistry.RewardVaultType) {
        return REGISTRY().getAccountToAssetToDefaultType(OWNER(), _asset);
    }

    function getStakedBalanceByAssetAndType(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) public view returns (uint256) {
        return _getUint256InNestedMap(_STAKED_BALANCES_SLOT, _asset, uint256(_type));
    }

    // ==================================================================
    // ======================== Internal Functions ======================
    // ==================================================================

    function _resetBgtValidatorIfEmptyBoosts(IBGT _bgt) internal {
        uint128 queuedBoost = _bgt.queuedBoost(address(this));
        uint128 boosts = _bgt.boosts(address(this));
        if (queuedBoost == 0 && boosts == 0 && bgtValidator() != address(0)) {
            _setAddress(_BGT_VALIDATOR_SLOT, address(0));
            emit ValidatorSet(address(0));
        }
    }

    function _resetBgtmValidatorIfEmptyBoosts(IBGTM _bgtm) internal {
        if (bgtmValidator() == address(0)) {
            return;
        }

        uint256 pending = _bgtm.pending(bgtmValidator(), address(this));
        uint256 queued = _bgtm.queued(bgtmValidator(), address(this));
        uint256 confirmed = _bgtm.confirmed(bgtmValidator(), address(this));
        if (pending == 0 && queued == 0 && confirmed == 0) {
            _setAddress(_BGTM_VALIDATOR_SLOT, address(0));
            emit ValidatorSet(address(0));
        }
    }

    function _setDefaultRewardVaultTypeByAsset(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) internal {
        if (_type == getDefaultRewardVaultTypeByAsset(_asset)) {
            // No need to change it when the two already match
            return;
        }

        REGISTRY().setDefaultRewardVaultTypeFromMetaVaultByAsset(_asset, _type);

        if (_type == IBerachainRewardsRegistry.RewardVaultType.BGTM) {
            INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));
            rewardVault.setOperator(address(REGISTRY().bgtm()));
        }
    }

    function _stake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) internal {
        IBerachainRewardsRegistry rewardRegistry = REGISTRY();
        INativeRewardVault rewardVault = INativeRewardVault(rewardRegistry.rewardVault(_asset, _type));

        _setDefaultRewardVaultTypeByAsset(_asset, _type);
        uint256 stakedBalance = getStakedBalanceByAssetAndType(_asset, _type);
        _setUint256InNestedMap(_STAKED_BALANCES_SLOT, _asset, uint256(_type), stakedBalance + _amount);

        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_asset).safeApprove(address(rewardVault), _amount);
        rewardVault.stake(_amount);
    }

    function _unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) internal {
        INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));

        uint256 stakedBalance = getStakedBalanceByAssetAndType(_asset, _type);
        _setUint256InNestedMap(_STAKED_BALANCES_SLOT, _asset, uint256(_type), stakedBalance - _amount);

        rewardVault.withdraw(_amount);
        IERC20(_asset).safeTransfer(msg.sender, _amount);
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

    function _requireActiveBgtValidator(address _validator) internal view {
        Require.that(
            bgtValidator() == _validator,
            _FILE,
            "Does not match bgt validator"
        );
    }

    function _requireActiveBgtmValidator(address _validator) internal view {
        Require.that(
            bgtmValidator() == _validator,
            _FILE,
            "Does not match bgtm validator"
        );
    }

    function _requireValidDolomiteToken(address _asset) internal view {
        (bool isValidDolomiteToken,) = address(REGISTRY().DOLOMITE_MARGIN()).staticcall(
            abi.encodeWithSelector(
                IDolomiteMargin.getMarketIdByTokenAddress.selector,
                IERC4626(_asset).asset()
            )
        );
        Require.that(
            isValidDolomiteToken && REGISTRY().DOLOMITE_MARGIN().getIsGlobalOperator(_asset),
            _FILE,
            "Invalid Dolomite token"
        );
    }
}
