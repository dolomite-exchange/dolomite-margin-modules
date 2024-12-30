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
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IBGT } from "./interfaces/IBGT.sol";
import { IBGTM } from "./interfaces/IBGTM.sol";
import { IBerachainRewardsMetaVault } from "./interfaces/IBerachainRewardsMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredVault } from "./interfaces/IInfraredVault.sol";
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
    bytes32 private constant _BGT_VALIDATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgtValidator")) - 1);
    bytes32 private constant _BGTM_VALIDATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgtmValidator")) - 1);
    bytes32 private constant _STAKED_BALANCES_SLOT = bytes32(uint256(keccak256("eip1967.proxy.stakedBalances")) - 1);
    bytes32 private constant _QUEUE_BGTM_COOLDOWN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.queueBgtmCooldown")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _UNBOND_BGTM_WAITING_PERIOD_SLOT = bytes32(uint256(keccak256("eip1967.proxy.unbondBgtmWaitingPeriod")) - 1); // solhint-disable-line max-line-length


    /// @dev This variable is hardcoded here because it's private in the BGT contract
    uint256 public constant HISTORY_BUFFER_LENGTH = 8191;
    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 public constant QUEUE_BGTM_COOLDOWN_BLOCKS = 8400;
    /// @dev We can change this later if we decide that un-bonding should require a waiting period
    uint256 public constant UNBOND_BGTM_WAITING_PERIOD_BLOCKS = 0;

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
        return _getReward(_asset);
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
        /*assert(balance > 0);*/
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
            emit BgtValidatorSet(_validator);
        } else {
            if (currentValidator == _validator) { /* FOR COVERAGE TESTING */ }
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
        if (REGISTRY().bgt().boostedQueue(address(this), bgtValidator()).blockNumberLast != 0) { /* FOR COVERAGE TESTING */ }
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
            emit BgtmValidatorSet(_validator);
        } else {
            if (currentValidator == _validator) { /* FOR COVERAGE TESTING */ }
            Require.that(
                currentValidator == _validator,
                _FILE,
                "Does not match active validator"
            );
        }

        if (block.number >= _getUint256(_QUEUE_BGTM_COOLDOWN_SLOT) && block.number >= _getUint256(_UNBOND_BGTM_WAITING_PERIOD_SLOT)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            block.number >= _getUint256(_QUEUE_BGTM_COOLDOWN_SLOT)
                && block.number >= _getUint256(_UNBOND_BGTM_WAITING_PERIOD_SLOT),
            _FILE,
            "Queue boost cooldown not passed"
        );
        _setUint256(_QUEUE_BGTM_COOLDOWN_SLOT, block.number + QUEUE_BGTM_COOLDOWN_BLOCKS);

        REGISTRY().bgtm().delegate(_validator, SafeCast.toUint128(_amount));
    }

    function activateBGTM(
        address _validator
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtmValidator(_validator) {
        REGISTRY().bgtm().activate(_validator);
    }

    function cancelBGTM(
        address _validator,
        uint256 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtmValidator(_validator) {
        IBGTM bgtm = REGISTRY().bgtm();
        bgtm.cancel(_validator, SafeCast.toUint128(_amount));
        _resetBgtmValidatorIfEmptyBoosts(bgtm);
    }

    function unbondBGTM(
        address _validator,
        uint256 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyActiveBgtmValidator(_validator) {
        _setUint256(_UNBOND_BGTM_WAITING_PERIOD_SLOT, block.number + UNBOND_BGTM_WAITING_PERIOD_BLOCKS);

        IBGTM bgtm = REGISTRY().bgtm();
        bgtm.unbond(_validator, SafeCast.toUint128(_amount));
        _resetBgtmValidatorIfEmptyBoosts(bgtm);
    }

    function withdrawBGTAndRedeem(
        address _recipient,
        uint256 _amount
    ) external {
        if (REGISTRY().bgtIsolationModeVaultFactory().getVaultByAccount(OWNER()) == msg.sender) { /* FOR COVERAGE TESTING */ }
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
        if (REGISTRY().bgtmIsolationModeVaultFactory().getVaultByAccount(OWNER()) == msg.sender) { /* FOR COVERAGE TESTING */ }
        Require.that(
            REGISTRY().bgtmIsolationModeVaultFactory().getVaultByAccount(OWNER()) == msg.sender,
            _FILE,
            "Not child BGTM vault"
        );

        IBGTM bgtm = REGISTRY().bgtm();
        uint256 bal = bgtm.getBalance(address(this));
        if (_amount > bal) {
            IBGTM.Position memory position = bgtm.getDelegatedBalance(bgtmValidator(), address(this));
            uint256 diff = _amount - bal;

            if (position.pending >= diff) {
                bgtm.cancel(bgtmValidator(), SafeCast.toUint128(diff));
            } else {
                if (position.confirmed + position.pending >= diff) { /* FOR COVERAGE TESTING */ }
                Require.that(
                    position.confirmed + position.pending >= diff,
                    _FILE,
                    "Not enough BGTM available"
                );
                if (position.pending > 0) {
                    bgtm.cancel(bgtmValidator(), SafeCast.toUint128(position.pending));
                }
                bgtm.unbond(bgtmValidator(), SafeCast.toUint128(diff - position.pending));
            }

            _resetBgtmValidatorIfEmptyBoosts(bgtm);
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
            emit BgtValidatorSet(address(0));
        }
    }

    function _resetBgtmValidatorIfEmptyBoosts(IBGTM _bgtm) internal {
        if (bgtmValidator() == address(0)) {
            return;
        }

        IBGTM.Position memory position = _bgtm.getDelegatedBalance(bgtmValidator(), address(this));
        if (position.pending == 0 && position.queued == 0 && position.confirmed == 0) {
            _setAddress(_BGTM_VALIDATOR_SLOT, address(0));
            emit BgtmValidatorSet(address(0));
        }
    }

    function _setDefaultRewardVaultTypeByAsset(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) internal {
        IBerachainRewardsRegistry.RewardVaultType currentType = getDefaultRewardVaultTypeByAsset(_asset);
        if (_type == currentType) {
            // No need to change it when the two already match
            return;
        } else {
            if (getStakedBalanceByAssetAndType(_asset, currentType) == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                getStakedBalanceByAssetAndType(_asset, currentType) == 0,
                _FILE,
                "Default type must be empty"
            );
        }

        _getReward(_asset);
        REGISTRY().setDefaultRewardVaultTypeFromMetaVaultByAsset(_asset, _type);

        if (_type == IBerachainRewardsRegistry.RewardVaultType.BGTM) {
            INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, _type));
            // @follow-up Test if this will revert if done more than once
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

    function _getReward(address _asset) internal returns (uint256) {
        IBerachainRewardsRegistry.RewardVaultType defaultType = getDefaultRewardVaultTypeByAsset(_asset);
        address rewardVault = REGISTRY().rewardVault(_asset, defaultType);
        IMetaVaultRewardTokenFactory factory;
        uint256 reward;

        if (defaultType == IBerachainRewardsRegistry.RewardVaultType.NATIVE) {
            reward = INativeRewardVault(rewardVault).getReward(address(this));
            factory = REGISTRY().bgtIsolationModeVaultFactory();
        } else if (defaultType == IBerachainRewardsRegistry.RewardVaultType.BGTM) {
            reward = INativeRewardVault(rewardVault).earned(address(this));
            address[] memory vaults = new address[](1);
            vaults[0] = rewardVault;
            if (reward > 0) {
                REGISTRY().bgtm().deposit(vaults);
            }
            factory = REGISTRY().bgtmIsolationModeVaultFactory();
        } else {
            /*assert(defaultType == IBerachainRewardsRegistry.RewardVaultType.INFRARED);*/
            factory = REGISTRY().iBgtIsolationModeVaultFactory();
            IERC20 iBgt = REGISTRY().iBgt();

            uint256 balanceBefore = iBgt.balanceOf(address(this));
            IInfraredVault(rewardVault).getReward();
            reward = iBgt.balanceOf(address(this)) - balanceBefore;
        }

        if (reward > 0) {
            _performDepositRewardByRewardType(factory, defaultType, reward);
        }

        return reward;
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

        /*assert(!IMetaVaultRewardReceiver(vault).isDepositSourceMetaVault());*/
        if (_type == IBerachainRewardsRegistry.RewardVaultType.INFRARED) {
            // Check the allowance was spent
            /*assert(IERC20(REGISTRY().iBgt()).allowance(vault, address(this)) == 0);*/
        }
    }

    function _requireOnlyChildVault(address _sender) internal view {
        if (REGISTRY().getMetaVaultByVault(_sender) == address(this)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            REGISTRY().getMetaVaultByVault(_sender) == address(this),
            _FILE,
            "Only child vault can call",
            _sender
        );
    }

    function _requireOnlyMetaVaultOwner(address _sender) internal view {
        if (OWNER() == _sender) { /* FOR COVERAGE TESTING */ }
        Require.that(
            OWNER() == _sender,
            _FILE,
            "Only owner can call",
            _sender
        );
    }

    function _requireActiveBgtValidator(address _validator) internal view {
        if (bgtValidator() == _validator) { /* FOR COVERAGE TESTING */ }
        Require.that(
            bgtValidator() == _validator,
            _FILE,
            "Does not match bgt validator"
        );
    }

    function _requireActiveBgtmValidator(address _validator) internal view {
        if (bgtmValidator() == _validator) { /* FOR COVERAGE TESTING */ }
        Require.that(
            bgtmValidator() == _validator,
            _FILE,
            "Does not match bgtm validator"
        );
    }

    function _requireValidDolomiteToken(address _asset) internal view {
        IDolomiteMargin dolomiteMargin = REGISTRY().DOLOMITE_MARGIN();
        (bool isValidDolomiteToken,) = address(dolomiteMargin).staticcall(
            abi.encodeWithSelector(
                IDolomiteMargin.getMarketIdByTokenAddress.selector,
                IERC4626(_asset).asset()
            )
        );
        if (isValidDolomiteToken && dolomiteMargin.getIsGlobalOperator(_asset)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidDolomiteToken && dolomiteMargin.getIsGlobalOperator(_asset),
            _FILE,
            "Invalid Dolomite token"
        );
    }
}
