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

import { BaseRegistry } from "@dolomite-exchange/modules-base/contracts/general/BaseRegistry.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { MetaVaultUpgradeableProxy } from "./MetaVaultUpgradeableProxy.sol";
import { IBGT } from "./interfaces/IBGT.sol";
import { IBGTM } from "./interfaces/IBGTM.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IBerachainRewardsVaultFactory } from "./interfaces/IBerachainRewardsVaultFactory.sol";
import { IInfrared } from "./interfaces/IInfrared.sol";
import { IInfraredVault } from "./interfaces/IInfraredVault.sol";
import { IMetaVaultRewardTokenFactory } from "./interfaces/IMetaVaultRewardTokenFactory.sol";
import { IMetaVaultUpgradeableProxy } from "./interfaces/IMetaVaultUpgradeableProxy.sol";


/**
 * @title   BerachainRewardsRegistry
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the BerachainRewards-related addresses. This registry is
 *          needed to offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as
 *          possible without having to deprecate the system and force users to migrate when Dolomite needs to point to
 *          new contracts or functions that Arbitrum introduces.
 */
contract BerachainRewardsRegistry is IBerachainRewardsRegistry, BaseRegistry {

    // ================================================
    // ==================== Constants =================
    // ================================================

    bytes32 private constant _FILE = "BerachainRewardsRegistry";
    address private constant _DEAD_VAULT = 0x000000000000000000000000000000000000dEaD;

    bytes32 private constant _BERACHAIN_REWARDS_VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.berachainRewardsVaultFactory")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _BGT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgt")) - 1);
    bytes32 private constant _BGT_ISOLATION_MODE_VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgtIsolationModeVaultFactory")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _BGTM_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgtm")) - 1);
    bytes32 private constant _BGTM_ISOLATION_MODE_VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgtmIsolationModeVaultFactory")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _I_BGT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.iBgt")) - 1);
    bytes32 private constant _I_BGT_ISOLATION_MODE_VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.iBgtIsolationModeVaultFactory")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _I_BGT_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.iBgtVault")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _INFRARED_SLOT = bytes32(uint256(keccak256("eip1967.proxy.infrared")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _META_VAULT_IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.metaVaultImplementation")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _REWARD_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.rewardVault")) - 1);
    bytes32 private constant _WBERA_SLOT = bytes32(uint256(keccak256("eip1967.proxy.wbera")) - 1);

    bytes32 private constant _ACCOUNT_TO_META_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.accountToMetaVault")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _META_VAULT_TO_ACCOUNT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.metaVaultToAccount")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _VAULT_TO_META_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultToMetaVault")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _ACCOUNT_TO_ASSET_DEFAULT_TYPE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.accountToAssetToDefaultType")) - 1); // solhint-disable-line max-line-length

    // ================================================
    // ================== Initializer =================
    // ================================================

    function initialize(
        address _bgt,
        address _bgtm,
        address _iBgt,
        address _berachainRewardsVaultFactory,
        address _infrared,
        address _iBgtVault,
        address _metaVaultImplementation,
        address _dolomiteRegistry,
        address _wbera
    ) external initializer {
        _ownerSetBgt(_bgt);
        _ownerSetBgtm(_bgtm);
        _ownerSetIBgt(_iBgt);
        _ownerSetBerachainRewardsVaultFactory(_berachainRewardsVaultFactory);
        _ownerSetInfrared(_infrared);
        _ownerSetIBgtVault(_iBgtVault);
        _ownerSetMetaVaultImplementation(_metaVaultImplementation);
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
        _ownerSetWbera(_wbera);
        _createMetaVault(_DEAD_VAULT);
    }

    // ================================================
    // ================ Public Functions ==============
    // ================================================

    function createMetaVault(
        address _account,
        address _vault
    ) external override onlyDolomiteMarginGlobalOperator(msg.sender) returns (address) {
        (bool isTokenVault,) = address(DOLOMITE_MARGIN()).staticcall(
            abi.encodeWithSelector(DOLOMITE_MARGIN().getMarketIdByTokenAddress.selector, msg.sender)
        );
        Require.that(
            isTokenVault,
            _FILE,
            "Caller is not a valid factory",
            msg.sender
        );

        address metaVault = getMetaVaultByAccount(_account);
        if (metaVault == address(0)) {
            metaVault = _createMetaVault(_account);
        }

        _setVaultToMetaVault(_vault, metaVault);

        return metaVault;
    }

    function setDefaultRewardVaultTypeFromMetaVaultByAsset(
        address _asset,
        RewardVaultType _type
    ) external {
        address account = getAccountByMetaVault(msg.sender);
        Require.that(
            account != address(0),
            _FILE,
            "Unauthorized meta vault",
            msg.sender
        );

        _setUint256InNestedMap(_ACCOUNT_TO_ASSET_DEFAULT_TYPE_SLOT, account, _asset, uint256(_type));
        emit AccountToAssetToDefaultTypeSet(account, _asset, _type);
    }

    // ================================================
    // ================ Admin Functions ===============
    // ================================================

    function ownerSetBerachainRewardsVaultFactory(
        address _berachainRewardsVaultFactory
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBerachainRewardsVaultFactory(_berachainRewardsVaultFactory);
    }

    function ownerSetBgt(address _bgt) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBgt(_bgt);
    }

    function ownerSetBgtm(address _bgtm) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBgtm(_bgtm);
    }

    function ownerSetBgtIsolationModeVaultFactory(
        address _bgtIsolationModeVaultFactory
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBgtIsolationModeVaultFactory(_bgtIsolationModeVaultFactory);
    }

    function ownerSetBgtmIsolationModeVaultFactory(
        address _bgtmIsolationModeVaultFactory
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBgtmIsolationModeVaultFactory(_bgtmIsolationModeVaultFactory);
    }

    function ownerSetIBgtIsolationModeVaultFactory(
        address _iBgtIsolationModeVaultFactory
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIBgtIsolationModeVaultFactory(_iBgtIsolationModeVaultFactory);
    }

    function ownerSetIBgt(address _iBgt) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIBgt(_iBgt);
    }

    function ownerSetIBgtVault(
        address _iBgtVault
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIBgtVault(_iBgtVault);
    }

    function ownerSetInfrared(
        address _infrared
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetInfrared(_infrared);
    }

    function ownerSetMetaVaultImplementation(
        address _metaVaultImplementation
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMetaVaultImplementation(_metaVaultImplementation);
    }

    function ownerSetRewardVault(
        address _asset,
        RewardVaultType _type,
        address _rewardVault
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRewardVault(_asset, _type, _rewardVault);
    }

    function ownerSetWbera(
        address _wbera
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetWbera(_wbera);
    }

    // ===================================================
    // ================== View Functions =================
    // ===================================================

    function bgt() external view override returns (IBGT) {
        return IBGT(_getAddress(_BGT_SLOT));
    }

    function bgtm() external view override returns (IBGTM) {
        return IBGTM(_getAddress(_BGTM_SLOT));
    }

    function bgtIsolationModeVaultFactory(
    ) public view override returns (IMetaVaultRewardTokenFactory) {
        return IMetaVaultRewardTokenFactory(_getAddress(_BGT_ISOLATION_MODE_VAULT_FACTORY_SLOT));
    }

    function bgtmIsolationModeVaultFactory(
    ) public view override returns (IMetaVaultRewardTokenFactory) {
        return IMetaVaultRewardTokenFactory(_getAddress(_BGTM_ISOLATION_MODE_VAULT_FACTORY_SLOT));
    }

    function iBgt() external view override returns (IERC20) {
        return IERC20(_getAddress(_I_BGT_SLOT));
    }

    function iBgtIsolationModeVaultFactory(
    ) public view override returns (IMetaVaultRewardTokenFactory) {
        return IMetaVaultRewardTokenFactory(_getAddress(_I_BGT_ISOLATION_MODE_VAULT_FACTORY_SLOT));
    }

    function iBgtVault() external view override returns (IInfraredVault) {
        return IInfraredVault(_getAddress(_I_BGT_VAULT_SLOT));
    }

    function metaVaultImplementation() external view override returns (address) {
        return _getAddress(_META_VAULT_IMPLEMENTATION_SLOT);
    }

    function calculateMetaVaultByAccount(address _account) external view override returns (address) {
        return Create2.computeAddress(
            keccak256(abi.encodePacked(_account)),
            keccak256(type(MetaVaultUpgradeableProxy).creationCode)
        );
    }

    function wbera() external view override returns (IWETH) {
        return IWETH(_getAddress(_WBERA_SLOT));
    }

    function berachainRewardsVaultFactory() public view override returns (IBerachainRewardsVaultFactory) {
        return IBerachainRewardsVaultFactory(_getAddress(_BERACHAIN_REWARDS_VAULT_FACTORY_SLOT));
    }

    function infrared() public view override returns (IInfrared) {
        return IInfrared(_getAddress(_INFRARED_SLOT));
    }

    function rewardVault(address _asset, RewardVaultType _type) public view override returns (address) {
        address overrideVault =  _getAddressInNestedMap(_REWARD_VAULT_SLOT, _asset, uint256(_type));
        if (overrideVault != address(0)) {
            return overrideVault;
        }

        if (_type == RewardVaultType.NATIVE || _type == RewardVaultType.BGTM) {
            return berachainRewardsVaultFactory().getVault(_asset);
        } else {
            assert(_type == RewardVaultType.INFRARED);
            return infrared().vaultRegistry(_asset);
        }
    }

    function getAccountToAssetToDefaultType(
        address _account,
        address _asset
    ) public view override returns (RewardVaultType) {
        return RewardVaultType(_getUint256InNestedMap(_ACCOUNT_TO_ASSET_DEFAULT_TYPE_SLOT, _account, _asset));
    }

    function getMetaVaultByAccount(address _account) public view override returns (address) {
        return _getAddressFromMap(_ACCOUNT_TO_META_VAULT_SLOT, _account);
    }

    function getAccountByMetaVault(address _metaVault) public view override returns (address) {
        return _getAddressFromMap(_META_VAULT_TO_ACCOUNT_SLOT, _metaVault);
    }

    function getMetaVaultByVault(address _vault) public view override returns (address) {
        return _getAddressFromMap(_VAULT_TO_META_VAULT_SLOT, _vault);
    }

    // ================================================
    // =============== Internal Functions =============
    // ================================================

    function _createMetaVault(address _account) internal returns (address) {
        address metaVault = Create2.deploy(
            /* amount = */ 0,
            keccak256(abi.encodePacked(_account)),
            type(MetaVaultUpgradeableProxy).creationCode
        );
        assert(metaVault != address(0));
        emit MetaVaultCreated(_account, metaVault);

        _setAddressInMap(_META_VAULT_TO_ACCOUNT_SLOT, metaVault, _account);
        _setAddressInMap(_ACCOUNT_TO_META_VAULT_SLOT, _account, metaVault);
        _initializeVault(metaVault, _account);

        return metaVault;
    }

    function _setVaultToMetaVault(address _vault, address _metaVault) internal {
        _setAddressInMap(_VAULT_TO_META_VAULT_SLOT, _vault, _metaVault);
        emit VaultToMetaVaultSet(_vault, _metaVault);
    }

    function _initializeVault(address _metaVault, address _account) internal {
        assert(_metaVault != address(0) && _account != address(0));
        IMetaVaultUpgradeableProxy(_metaVault).initialize(_account);
    }

    function _ownerSetBerachainRewardsVaultFactory(address _berachainRewardsVaultFactory) internal {
        Require.that(
            _berachainRewardsVaultFactory != address(0),
            _FILE,
            "Invalid vault factory address"
        );
        _setAddress(_BERACHAIN_REWARDS_VAULT_FACTORY_SLOT, _berachainRewardsVaultFactory);
        emit BerachainRewardsVaultFactorySet(_berachainRewardsVaultFactory);
    }

    function _ownerSetBgt(address _bgt) internal {
        Require.that(
            _bgt != address(0),
            _FILE,
            "Invalid BGT address"
        );
        _setAddress(_BGT_SLOT, _bgt);
        emit BgtSet(_bgt);
    }

    function _ownerSetBgtm(address _bgtm) internal {
        Require.that(
            _bgtm != address(0),
            _FILE,
            "Invalid BGTM address"
        );
        _setAddress(_BGTM_SLOT, _bgtm);
        emit BgtmSet(_bgtm);
    }

    function _ownerSetBgtIsolationModeVaultFactory(
        address _bgtIsolationModeVaultFactory
    ) internal {
        Require.that(
            _bgtIsolationModeVaultFactory != address(0),
            _FILE,
            "Invalid bgt factory address"
        );
        _setAddress(_BGT_ISOLATION_MODE_VAULT_FACTORY_SLOT, _bgtIsolationModeVaultFactory);
        emit BgtIsolationModeVaultFactorySet(_bgtIsolationModeVaultFactory);
    }

    function _ownerSetBgtmIsolationModeVaultFactory(
        address _bgtmIsolationModeVaultFactory
    ) internal {
        Require.that(
            _bgtmIsolationModeVaultFactory != address(0),
            _FILE,
            "Invalid bgtm factory address"
        );
        _setAddress(_BGTM_ISOLATION_MODE_VAULT_FACTORY_SLOT, _bgtmIsolationModeVaultFactory);
        emit BgtmIsolationModeVaultFactorySet(_bgtmIsolationModeVaultFactory);
    }

    function _ownerSetIBgt(address _iBgt) internal {
        Require.that(
            _iBgt != address(0),
            _FILE,
            "Invalid iBGT address"
        );
        _setAddress(_I_BGT_SLOT, _iBgt);
        emit IBgtSet(_iBgt);
    }

    function _ownerSetIBgtIsolationModeVaultFactory(
        address _iBgtIsolationModeVaultFactory
    ) internal {
        Require.that(
            _iBgtIsolationModeVaultFactory != address(0),
            _FILE,
            "Invalid iBgt factory address"
        );
        _setAddress(_I_BGT_ISOLATION_MODE_VAULT_FACTORY_SLOT, _iBgtIsolationModeVaultFactory);
        emit IBgtIsolationModeVaultFactorySet(_iBgtIsolationModeVaultFactory);
    }

    function _ownerSetIBgtVault(address _iBgtVault) internal {
        Require.that(
            _iBgtVault != address(0),
            _FILE,
            "Invalid iBgtVault address"
        );
        _setAddress(_I_BGT_VAULT_SLOT, _iBgtVault);
        emit IBgtVaultSet(_iBgtVault);
    }

    function _ownerSetInfrared(address _infrared) internal {
        Require.that(
            _infrared != address(0),
            _FILE,
            "Invalid infrared address"
        );
        _setAddress(_INFRARED_SLOT, _infrared);
        emit InfraredSet(_infrared);
    }

    function _ownerSetMetaVaultImplementation(address _metaVaultImplementation) internal {
        Require.that(
            _metaVaultImplementation != address(0),
            _FILE,
            "Invalid implementation address"
        );
        _setAddress(_META_VAULT_IMPLEMENTATION_SLOT, _metaVaultImplementation);
        emit MetaVaultImplementationSet(_metaVaultImplementation);
    }

    function _ownerSetRewardVault(address _asset, RewardVaultType _type, address _rewardVault) internal {
        Require.that(
            _rewardVault != address(0),
            _FILE,
            "Invalid rewardVault address"
        );
        _setAddressInNestedMap(_REWARD_VAULT_SLOT, _asset, uint256(_type), _rewardVault);
        emit RewardVaultSet(_asset, _type, _rewardVault);
    }

    function _ownerSetWbera(address _wbera) internal {
        Require.that(
            _wbera != address(0),
            _FILE,
            "Invalid wbera address"
        );
        _setAddress(_WBERA_SLOT, _wbera);
        emit WberaSet(_wbera);
    }
}
