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
import { IBGTM } from "./IBGTM.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { IBerachainRewardsVaultFactory } from "./IBerachainRewardsVaultFactory.sol";
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
        NATIVE,
        INFRARED,
        BGTM
    }

    // ================================================
    // ==================== Events ====================
    // ================================================

    event AccountToAssetToDefaultTypeSet(address indexed account, address indexed asset, RewardVaultType rewardType);
    event BerachainRewardsVaultFactorySet(address berachainRewardsVaultFactory);
    event BgtSet(address bgt);
    event BgtmSet(address bgtm);
    event BgtIsolationModeVaultFactorySet(address bgtIsolationModeVaultFactory);
    event BgtmIsolationModeVaultFactorySet(address bgtmIsolationModeVaultFactory);
    event IBgtSet(address iBgt);
    event IBgtIsolationModeVaultFactorySet(address iBgtIsolationModeVaultFactory);
    event IBgtVaultSet(address iBgtVault);
    event InfraredSet(address infrared);
    event MetaVaultCreated(address indexed account, address metaVault);
    event MetaVaultImplementationSet(address metaVaultImplementation);
    event RewardVaultSet(address asset, RewardVaultType rewardVaultType, address rewardVault);
    event VaultToMetaVaultSet(address indexed vault, address metaVault);
    event WberaSet(address wbera);

    // ===================================================
    // ================== Admin Functions ================
    // ===================================================

    function ownerSetBerachainRewardsVaultFactory(address _berachainRewardsVaultFactory) external;
    function ownerSetBgt(address _bgt) external;
    function ownerSetBgtm(address _bgtm) external;
    function ownerSetBgtIsolationModeVaultFactory(address _bgtIsolationModeVaultFactory) external;
    function ownerSetBgtmIsolationModeVaultFactory(address _bgtmIsolationModeVaultFactory) external;
    function ownerSetIBgt(address _iBgt) external;
    function ownerSetIBgtIsolationModeVaultFactory(address _iBgtIsolationModeVaultFactory) external;
    function ownerSetIBgtVault(address _iBgtVault) external;
    function ownerSetInfrared(address _infrared) external;
    function ownerSetMetaVaultImplementation(address _metaVaultImplementation) external;
    function ownerSetRewardVault(address _asset, RewardVaultType _type, address _rewardVault) external;
    function ownerSetWbera(address _wbera) external;

    // ===================================================
    // ================== Public Functions ===============
    // ===================================================

    function createMetaVault(address _account, address _vault) external returns (address);
    function setDefaultRewardVaultTypeFromMetaVaultByAsset(address _asset, RewardVaultType _type) external;

    // ===================================================
    // ================== View Functions =================
    // ===================================================

    function calculateMetaVaultByAccount(address _account) external view returns (address);
    function getMetaVaultByAccount(address _account) external view returns (address);
    function getAccountByMetaVault(address _metaVault) external view returns (address);
    function getMetaVaultByVault(address _vault) external view returns (address);
    function getAccountToAssetToDefaultType(
        address _account,
        address _asset
    ) external view returns (RewardVaultType);

    function berachainRewardsVaultFactory() external view returns (IBerachainRewardsVaultFactory);
    function bgt() external view returns (IBGT);
    function bgtm() external view returns (IBGTM);
    function bgtIsolationModeVaultFactory() external view returns (IMetaVaultRewardTokenFactory);
    function bgtmIsolationModeVaultFactory() external view returns (IMetaVaultRewardTokenFactory);
    function iBgt() external view returns (IERC20);
    function iBgtIsolationModeVaultFactory() external view returns (IMetaVaultRewardTokenFactory);
    function iBgtVault() external view returns (IInfraredVault);
    function infrared() external view returns (IInfrared);
    function metaVaultImplementation() external view returns (address);
    function rewardVault(address _asset, RewardVaultType _type) external view returns (address);
    function wbera() external view returns (IWETH);
}
