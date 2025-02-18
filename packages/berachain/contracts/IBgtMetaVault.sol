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
import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IBGT } from "./interfaces/IBGT.sol";
import { IBGTM } from "./interfaces/IBGTM.sol";
import { IBaseMetaVault } from "./interfaces/IBaseMetaVault.sol";
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
contract IBgtMetaVault is ProxyContractHelpers, IBaseMetaVault {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "BerachainRewardsMetaVault";
    bytes32 private constant _REGISTRY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.registry")) - 1);
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);
    bytes32 private constant _STAKED_BALANCES_SLOT = bytes32(uint256(keccak256("eip1967.proxy.stakedBalances")) - 1);

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
        _stake(_asset, _amount);
    }

    function unstakeDolomiteToken(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyMetaVaultOwner(msg.sender) onlyValidDolomiteToken(_asset) {
        _unstake(_asset, _amount);
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
        _stake(_asset, _amount);
    }

    function unstake(
        address _asset,
        IBerachainRewardsRegistry.RewardVaultType _type,
        uint256 _amount
    ) external onlyChildVault(msg.sender) {
        _unstake(_asset, _amount);
    }

    function getReward(
        address _asset
    ) external onlyMetaVaultOwner(msg.sender) returns (uint256) {
        return _getReward(_asset);
    }

    function exit(
        address _asset
    ) external onlyChildVault(msg.sender) {
        IERC20 token = REGISTRY().iBgt();
        IMetaVaultRewardTokenFactory factory = REGISTRY().iBgtIsolationModeVaultFactory();

        uint256 balanceBefore = token.balanceOf(address(this));
        IInfraredVault infraredVault = IInfraredVault(REGISTRY().rewardVault(_asset, IBerachainRewardsRegistry.RewardVaultType.INFRARED));
        infraredVault.exit();

        uint256 balance = IERC20(_asset).balanceOf(address(this));
        assert(balance > 0);
        IERC20(_asset).safeTransfer(msg.sender, balance);

        uint256 reward = token.balanceOf(address(this)) - balanceBefore;
        if (reward > 0) {
            _performDepositRewardByRewardType(factory, reward);
        }

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
    ) internal {
        Require.that(
            _type == IBerachainRewardsRegistry.RewardVaultType.INFRARED,
            _FILE,
            "Only infrared is supported"
        );
        IBerachainRewardsRegistry.RewardVaultType currentType = getDefaultRewardVaultTypeByAsset(_asset);
        if (_type == currentType) {
            // No need to change it when the two already match
            return;
        } else {
            Require.that(
                getStakedBalanceByAssetAndType(_asset, currentType) == 0,
                _FILE,
                "Default type must be empty"
            );
        }

        _getReward(_asset);
        REGISTRY().setDefaultRewardVaultTypeFromMetaVaultByAsset(_asset, _type);
    }

    function _stake(
        address _asset,
        uint256 _amount
    ) internal {
        IBerachainRewardsRegistry.RewardVaultType infraredType = IBerachainRewardsRegistry.RewardVaultType.INFRARED;
        INativeRewardVault rewardVault = INativeRewardVault(REGISTRY().rewardVault(_asset, infraredType));

        _setDefaultRewardVaultTypeByAsset(_asset, infraredType);
        uint256 stakedBalance = getStakedBalanceByAssetAndType(_asset, infraredType);
        _setUint256InNestedMap(_STAKED_BALANCES_SLOT, _asset, uint256(infraredType), stakedBalance + _amount);

        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_asset).safeApprove(address(rewardVault), _amount);
        rewardVault.stake(_amount);
    }

    function _unstake(
        address _asset,
        uint256 _amount
    ) internal {
        IBerachainRewardsRegistry rewardRegistry = REGISTRY();
        IBerachainRewardsRegistry.RewardVaultType infraredType = IBerachainRewardsRegistry.RewardVaultType.INFRARED;
        INativeRewardVault rewardVault = INativeRewardVault(rewardRegistry.rewardVault(_asset, infraredType));

        uint256 stakedBalance = getStakedBalanceByAssetAndType(_asset, infraredType);
        _setUint256InNestedMap(_STAKED_BALANCES_SLOT, _asset, uint256(infraredType), stakedBalance - _amount);

        rewardVault.withdraw(_amount);
        IERC20(_asset).safeTransfer(msg.sender, _amount);
    }

    function _getReward(address _asset) internal returns (uint256) {
        address rewardVault = REGISTRY().rewardVault(_asset, IBerachainRewardsRegistry.RewardVaultType.INFRARED);

        IMetaVaultRewardTokenFactory factory = REGISTRY().iBgtIsolationModeVaultFactory();
        IERC20 iBgt = REGISTRY().iBgt();

        uint256 balanceBefore = iBgt.balanceOf(address(this));
        IInfraredVault(rewardVault).getReward();
        uint256 reward = iBgt.balanceOf(address(this)) - balanceBefore;

        if (reward > 0) {
            _performDepositRewardByRewardType(factory, reward);
        }

        return reward;
    }

    function _performDepositRewardByRewardType(
        IMetaVaultRewardTokenFactory _factory,
        uint256 _reward
    ) internal {
        address vault = _factory.getVaultByAccount(OWNER());
        if (vault == address(0)) {
            vault = _factory.createVault(OWNER());
        }

        IERC20(REGISTRY().iBgt()).safeApprove(vault, _reward);
        IMetaVaultRewardReceiver(vault).setIsDepositSourceMetaVault(true);
        _factory.depositIntoDolomiteMarginFromMetaVault(
            OWNER(),
            DEFAULT_ACCOUNT_NUMBER,
            _reward
        );

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

    function _requireValidDolomiteToken(address _asset) internal view {
        IDolomiteMargin dolomiteMargin = REGISTRY().DOLOMITE_MARGIN();
        (bool isValidDolomiteToken,) = address(dolomiteMargin).staticcall(
            abi.encodeWithSelector(
                IDolomiteMargin.getMarketIdByTokenAddress.selector,
                IERC4626(_asset).asset()
            )
        );
        Require.that(
            isValidDolomiteToken && dolomiteMargin.getIsGlobalOperator(_asset),
            _FILE,
            "Invalid Dolomite token"
        );
    }
}
