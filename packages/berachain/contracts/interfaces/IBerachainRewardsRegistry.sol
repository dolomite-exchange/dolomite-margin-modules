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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBGT } from "./IBGT.sol";
import { IInfraredBGTStakingPool } from "./IInfraredBGTStakingPool.sol";
import { IMetaVaultOperator } from "./IMetaVaultOperator.sol";
import { IMetaVaultRewardReceiverFactory } from "./IMetaVaultRewardReceiverFactory.sol";


/**
 * @title   IBerachainRewardsRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with the Berachain rewards ecosystem
 */
interface IBerachainRewardsRegistry is IBaseRegistry {

    enum RewardVaultType {
        NATIVE,
        INFRARED
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event BgtSet(address bgt);
    event BgtIsolationModeVaultFactorySet(address bgtIsolationModeVaultFactory);
    event IBgtSet(address iBgt);
    event IBgtIsolationModeVaultFactorySet(address iBgtIsolationModeVaultFactory);
    event IBgtStakingPoolSet(address iBgtStakingPool);
    event MetaVaultCreated(address indexed account, address metaVault);
    event MetaVaultImplementationSet(address metaVaultImplementation);
    event MetaVaultOperatorSet(address metaVaultOperator);
    event RewardVaultSet(address asset, RewardVaultType rewardVaultType, address rewardVault);
    event AccountToAssetToDefaultTypeSet(address indexed _account, address _asset, RewardVaultType rewardVaultType);

    // ===================================================
    // ================== Admin Functions ================
    // ===================================================

    function ownerSetBgt(address _bgt) external;
    function ownerSetBgtIsolationModeVaultFactory(address _bgtIsolationModeVaultFactory) external;
    function ownerSetIBgt(address _iBgt) external;
    function ownerSetIBgtIsolationModeVaultFactory(address _iBgtIsolationModeVaultFactory) external;
    function ownerSetIBgtStakingPool(address _iBgtStakingPool) external;
    function ownerSetMetaVaultImplementation(address _metaVaultImplementation) external;
    function ownerSetMetaVaultOperator(address _metaVaultOperator) external;
    function ownerSetRewardVault(address _asset, RewardVaultType _type, address _rewardVault) external;

    // ===================================================
    // ================== Public Functions ===============
    // ===================================================

    function createMetaVault(address _account, address _vault) external returns (address);
    function setAccountToAssetToDefaultType(address _asset, RewardVaultType _type) external;

    // ===================================================
    // ================== View Functions =================
    // ===================================================

    function calculateMetaVaultByAccount(address _account) external view returns (address);
    function getAccountToAssetToDefaultType(address _asset, address _account) external view returns (RewardVaultType);
    function getAccountToMetaVault(address _account) external view returns (address);
    function getMetaVaultToAccount(address _metaVault) external view returns (address);
    function getVaultToMetaVault(address _vault) external view returns (address);

    function bgt() external view returns (IBGT);
    function bgtIsolationModeVaultFactory() external view returns (IMetaVaultRewardReceiverFactory);
    function iBgt() external view returns (IERC20);
    function iBgtIsolationModeVaultFactory() external view returns (IMetaVaultRewardReceiverFactory);
    function iBgtStakingPool() external view returns (IInfraredBGTStakingPool);
    function metaVaultImplementation() external view returns (address);
    function metaVaultOperator() external view returns (IMetaVaultOperator);
    function rewardVault(address _asset, RewardVaultType _type) external view returns (address);
}
