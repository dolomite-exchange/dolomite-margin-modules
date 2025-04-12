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

import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBaseMetaVault } from "./interfaces/IBaseMetaVault.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IInfraredVault } from "./interfaces/IInfraredVault.sol";
import { IMetaVaultRewardReceiver } from "./interfaces/IMetaVaultRewardReceiver.sol";
import { IMetaVaultRewardTokenFactory } from "./interfaces/IMetaVaultRewardTokenFactory.sol";


/**
 * @title   InfraredBGTMetaVault
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the underlying berachain rewards
 *          tokens that can be used to credit a user's Dolomite balance. Tokens held in the vault are considered
 *          to be in isolation mode - that is it cannot be borrowed by other users, may only be seized via
 *          liquidation, and cannot be held in the same position as other "isolated" tokens.
 */
contract InfraredBGTMetaVault is ProxyContractHelpers, IBaseMetaVault {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "InfraredBGTMetaVault";
    bytes32 private constant _REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.registry")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);
    bytes32 private constant _STAKED_BALANCES_SLOT = bytes32(uint256(keccak256("eip1967.proxy.stakedBalances")) - 1);

    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;
    uint256 private constant _BASE = 1 ether;

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyInfraredType(IBerachainRewardsRegistry.RewardVaultType _type) {
        Require.that(
            _type == IBerachainRewardsRegistry.RewardVaultType.INFRARED,
            _FILE,
            "Only infrared is supported"
        );
        _;
    }

    modifier onlyChildVault(address _sender) {
        _requireOnlyChildVault(_sender);
        _;
    }

    modifier onlyMetaVaultOwner(address _sender) {
        _requireOnlyMetaVaultOwner(_sender);
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    receive() external payable {}

    function setDefaultRewardVaultTypeByAsset(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) external onlyMetaVaultOwner(msg.sender) {
        _setDefaultRewardVaultTypeByAsset(_asset, _type);
    }

    function stakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _stake(_asset, _type, _amount, true);
    }

    function unstakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _unstake(_asset, _type, _amount, true);
    }

    function stake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _stake(_asset, _type, _amount, false);
    }

    function stakeIBgt(
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _stakeIBgt(_amount);
    }

    function unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _unstake(_asset, _type, _amount, false);
    }

    function unstakeIBgt(
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _unstakeIBgt(_amount);
    }

    function getReward(
        address _asset
    ) external onlyChildVault(msg.sender) {
        _getReward(IInfraredVault(REGISTRY().rewardVault(_asset, IBerachainRewardsRegistry.RewardVaultType.INFRARED)));
    }

    function getRewardIBgt() external onlyChildVault(msg.sender) {
        _getReward(IInfraredVault(REGISTRY().iBgtStakingVault()));
    }

    function exit(
        address _asset,
        bool _isDToken
    ) external onlyChildVault(msg.sender) {
        IBerachainRewardsRegistry.RewardVaultType vaultType = getDefaultRewardVaultTypeByAsset(_asset);
        _getReward(IInfraredVault(REGISTRY().rewardVault(_asset, vaultType)));
        _unstake(_asset, vaultType, getStakedBalanceByAssetAndType(_asset, vaultType), _isDToken);
    }

    function chargeDTokenFee(
        address _asset,
        uint256 _marketId,
        uint256 _amount
    ) external onlyChildVault(msg.sender) returns (uint256) {
        IBerachainRewardsRegistry registry = REGISTRY();
        uint256 feePercentage = registry.polFeePercentage(_marketId);
        address feeAgent = registry.polFeeAgent();

        uint256 feeAmount = (_amount * feePercentage) / _BASE;
        if (feeAmount > 0 && feeAgent != address(0)) {
            IERC20(_asset).safeTransfer(feeAgent, feeAmount);
            emit DTokenFeeCharged(_asset, feeAgent, feeAmount);
            return feeAmount;
        }

        return 0;
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

    function _setDefaultRewardVaultTypeByAsset(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type
    ) internal onlyInfraredType(_type) {
        IBerachainRewardsRegistry.RewardVaultType currentType = getDefaultRewardVaultTypeByAsset(_asset);
        if (_type == currentType) {
            // No need to change it when the two already match
            return;
        } else {
            assert(getStakedBalanceByAssetAndType(_asset, currentType) == 0);
        }

        _getReward(IInfraredVault(REGISTRY().rewardVault(_asset, _type)));
        REGISTRY().setDefaultRewardVaultTypeFromMetaVaultByAsset(_asset, _type);
    }

    function _stake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount,
        bool _isDToken
    ) internal onlyInfraredType(_type) {
        IInfraredVault rewardVault = IInfraredVault(REGISTRY().rewardVault(_asset, _type));

        _setDefaultRewardVaultTypeByAsset(_asset, _type);
        uint256 stakedBalance = getStakedBalanceByAssetAndType(_asset, _type);
        _setUint256InNestedMap(_STAKED_BALANCES_SLOT, _asset, uint256(_type), stakedBalance + _amount);

        // @dev D Tokens are pushed into the vault, and thus don't need to be pulled in via `safeTransferFrom`
        if (!_isDToken) {
            IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
        }
        IERC20(_asset).safeApprove(address(rewardVault), _amount);
        rewardVault.stake(_amount);
    }

    function _stakeIBgt(uint256 _amount) internal {
        IERC20 iBgt = IERC20(REGISTRY().iBgt());
        iBgt.safeTransferFrom(msg.sender, address(this), _amount);

        IInfraredVault vault = IInfraredVault(REGISTRY().iBgtStakingVault());
        iBgt.safeApprove(address(vault), _amount);
        vault.stake(_amount);
    }

    function _unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount,
        bool _isDToken
    ) internal onlyInfraredType(_type) {
        IInfraredVault rewardVault = IInfraredVault(REGISTRY().rewardVault(_asset, _type));

        uint256 stakedBalance = getStakedBalanceByAssetAndType(_asset, _type);
        _setUint256InNestedMap(_STAKED_BALANCES_SLOT, _asset, uint256(_type), stakedBalance - _amount);

        rewardVault.withdraw(_amount);

        if (!_isDToken) {
            IERC20(_asset).safeTransfer(msg.sender, _amount);
        }
    }

    function _unstakeIBgt(uint256 _amount) internal {
        IInfraredVault vault = IInfraredVault(REGISTRY().iBgtStakingVault());
        vault.withdraw(_amount);

        IERC20(REGISTRY().iBgt()).safeTransfer(msg.sender, _amount);
    }

    function _getReward(IInfraredVault _rewardVault) internal {
        IBerachainRewardsRegistry.RewardVaultType rewardVaultType = IBerachainRewardsRegistry.RewardVaultType.INFRARED;
        IMetaVaultRewardTokenFactory factory = REGISTRY().iBgtIsolationModeVaultFactory();

        IInfraredVault(_rewardVault).getReward();

        /// @dev    We loop through the reward tokens, not the UserReward[], since the array returns a length of 0 if a
        //          different user claims this vault's rewards on the user's behalf
        address[] memory rewardTokens = _rewardVault.getAllRewardTokens();
        for (uint256 i = 0; i < rewardTokens.length; ++i) {
            uint256 bal = IERC20(rewardTokens[i]).balanceOf(address(this));
            if (bal > 0) {
                _performDepositRewardByRewardType(
                    factory,
                    rewardVaultType,
                    rewardTokens[i],
                    bal
                );
            }
        }
    }

    function _performDepositRewardByRewardType(
        IMetaVaultRewardTokenFactory _factory,
        IBerachainRewardsRegistry.RewardVaultType _type,
        address _token,
        uint256 _amount
    ) internal {
        assert(_type == IBerachainRewardsRegistry.RewardVaultType.INFRARED);

        address owner = OWNER();
        address vault = _factory.getVaultByAccount(owner);
        if (vault == address(0)) {
            vault = _factory.createVault(owner);
        }

        if (_token == address(REGISTRY().iBgt())) {
            IERC20(_token).safeApprove(vault, _amount);
            IMetaVaultRewardReceiver(vault).setIsDepositSourceMetaVault(true);
            _factory.depositIntoDolomiteMarginFromMetaVault(
                owner,
                DEFAULT_ACCOUNT_NUMBER,
                _amount
            );
        } else {
            IDolomiteMargin dolomiteMargin = REGISTRY().DOLOMITE_MARGIN();
            try dolomiteMargin.getMarketIdByTokenAddress(_token) returns (uint256 marketId) {
                IERC20(_token).safeApprove(address(dolomiteMargin), _amount);
                try _factory.depositOtherTokenIntoDolomiteMarginFromMetaVault(
                    owner,
                    DEFAULT_ACCOUNT_NUMBER,
                    marketId,
                    _amount
                ) {} catch {
                    // If we can't deposit the token into Dolomite, reset the allowance and send the token directly to
                    // the owner
                    IERC20(_token).safeApprove(address(dolomiteMargin), 0);
                    IERC20(_token).safeTransfer(owner, _amount);
                }
            } catch {
                // If the token is not supported on Dolomite, send it directly to the owner
                IERC20(_token).safeTransfer(owner, _amount);
            }
        }

        assert(!IMetaVaultRewardReceiver(vault).isDepositSourceMetaVault());
        assert(IERC20(REGISTRY().iBgt()).allowance(vault, address(this)) == 0);
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
}
