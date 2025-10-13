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

import { IBaseRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IBaseRegistry.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBGT } from "./IBGT.sol";
import { IBGTM } from "./IBGTM.sol";
import { IBerachainRewardsFactory } from "./IBerachainRewardsFactory.sol";
import { IInfrared } from "./IInfrared.sol";
import { IInfraredVault } from "./IInfraredVault.sol";
import { IMetaVaultRewardTokenFactory } from "./IMetaVaultRewardTokenFactory.sol";


/**
 * @title   IBerachainRewardsRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the Berachain rewards ecosystem
 */
interface IBerachainRewardsRegistry is IBaseRegistry {

    // ================================================
    // ==================== Enums =====================
    // ================================================

    enum RewardVaultType {
        INFRARED,
        NATIVE,
        BGTM
    }

    // ================================================
    // =================== Structs ====================
    // ================================================

    struct InitializationParams {
        address bgt;
        address bgtm;
        address iBgt;
        address wbera;
        address berachainRewardsFactory;
        address iBgtStakingVault;
        address infrared;
        address metaVaultImplementation;
        address polLiquidator;
        bytes metaVaultProxyCreationCode;
        address dolomiteRegistry;
    }

    struct MetaVaultProxyCreationCode {
        bytes code;
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event BgtSet(address bgt);
    event BgtmSet(address bgtm);
    event IBgtSet(address iBgt);
    event WberaSet(address wbera);
    event WiBgtSet(address wiBgt);

    event BerachainRewardsFactorySet(address berachainRewardsFactory);
    event IBgtStakingVaultSet(address iBgtStakingVault);
    event InfraredSet(address infrared);
    event RewardVaultOverrideSet(address asset, RewardVaultType rewardVaultType, address rewardVault);

    event BgtIsolationModeVaultFactorySet(address bgtIsolationModeVaultFactory);
    event BgtmIsolationModeVaultFactorySet(address bgtmIsolationModeVaultFactory);
    event IBgtIsolationModeVaultFactorySet(address iBgtIsolationModeVaultFactory);

    event PolFeeAgentSet(address polFeeAgent);
    event PolFeePercentageSet(uint256 polFeePercentage);
    event PolLiquidatorSet(address polLiquidator);
    event PolTokenVaultSet(address polTokenVault);
    event PolUnwrapperTraderSet(address polUnwrapperTrader);
    event PolWrapperTraderSet(address polWrapperTrader);

    event AccountToAssetToDefaultTypeSet(address indexed account, address indexed asset, RewardVaultType rewardType);
    event MetaVaultCreated(address indexed account, address metaVault);
    event MetaVaultImplementationSet(address metaVaultImplementation);
    event MetaVaultProxyCreationCodeSet(bytes32 proxyInitHash);
    event VaultToMetaVaultSet(address indexed vault, address metaVault);

    // ===================================================
    // ================== Admin Functions ================
    // ===================================================

    function ownerSetBgt(address _bgt) external;
    function ownerSetBgtm(address _bgtm) external;
    function ownerSetIBgt(address _iBgt) external;
    function ownerSetWbera(address _wbera) external;
    function ownerSetWiBgt(address _wibgt) external;

    function ownerSetBerachainRewardsFactory(address _berachainRewardsFactory) external;
    function ownerSetIBgtStakingVault(address _iBgtStakingVault) external;
    function ownerSetInfrared(address _infrared) external;
    function ownerSetRewardVaultOverride(address _asset, RewardVaultType _type, address _rewardVault) external;

    function ownerSetBgtIsolationModeVaultFactory(address _bgtIsolationModeVaultFactory) external;
    function ownerSetBgtmIsolationModeVaultFactory(address _bgtmIsolationModeVaultFactory) external;
    function ownerSetIBgtIsolationModeVaultFactory(address _iBgtIsolationModeVaultFactory) external;

    function ownerSetPolFeeAgent(address _polFeeAgent) external;
    function ownerSetPolFeePercentage(uint256 _polFeePercentage) external;
    function ownerSetPolLiquidator(address _polLiquidator) external;
    function ownerSetPolTokenVault(address _polTokenVault) external;
    function ownerSetPolUnwrapperTrader(address _polUnwrapperTrader) external;
    function ownerSetPolWrapperTrader(address _polWrapperTrader) external;

    function ownerSetMetaVaultImplementation(address _metaVaultImplementation) external;
    function ownerSetMetaVaultProxyCreationCode(bytes calldata _creationCode) external;

    // ===================================================
    // ================== Public Functions ===============
    // ===================================================

    function createMetaVault(address _account, address _vault) external returns (address);
    function setDefaultRewardVaultTypeFromMetaVaultByAsset(address _asset, RewardVaultType _type) external;

    // ===================================================
    // ================== View Functions =================
    // ===================================================

    function bgt() external view returns (IBGT);
    function bgtm() external view returns (IBGTM);
    function iBgt() external view returns (IERC20);
    function wbera() external view returns (IWETH);
    function wiBgt() external view returns (IERC4626);

    function berachainRewardsFactory() external view returns (IBerachainRewardsFactory);
    function iBgtStakingVault() external view returns (IInfraredVault);
    function infrared() external view returns (IInfrared);
    function rewardVault(address _asset, RewardVaultType _type) external view returns (address);

    function bgtIsolationModeVaultFactory() external view returns (IMetaVaultRewardTokenFactory);
    function bgtmIsolationModeVaultFactory() external view returns (IMetaVaultRewardTokenFactory);
    function iBgtIsolationModeVaultFactory() external view returns (IMetaVaultRewardTokenFactory);

    function metaVaultImplementation() external view returns (address);
    function metaVaultProxyCreationCode() external view returns (bytes memory);
    function calculateMetaVaultByAccount(address _account) external view returns (address);
    function getMetaVaultByAccount(address _account) external view returns (address);
    function getAccountByMetaVault(address _metaVault) external view returns (address);
    function getMetaVaultByVault(address _vault) external view returns (address);
    function getAccountToAssetToDefaultType(
        address _account,
        address _asset
    ) external view returns (RewardVaultType);
    function getMetaVaultProxyInitCodeHash() external view returns (bytes32);

    function polFeeAgent() external view returns (address);
    function polFeePercentage(uint256 _marketId) external view returns (uint256);
    function polLiquidator() external view returns (address);
    function polTokenVault() external view returns (address);
    function polUnwrapperTrader() external view returns (address);
    function polWrapperTrader() external view returns (address);
}
