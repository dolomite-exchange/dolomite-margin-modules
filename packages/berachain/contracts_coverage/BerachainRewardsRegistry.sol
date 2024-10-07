// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

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
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { MetavaultUpgradeableProxy } from "./MetavaultUpgradeableProxy.sol";
import { IBGT } from "./interfaces/IBGT.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";
import { IMetavaultOperator } from "./interfaces/IMetavaultOperator.sol";
import { IMetavaultUpgradeableProxy } from "./interfaces/IMetavaultUpgradeableProxy.sol";


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

    bytes32 private constant _BGT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bgt")) - 1);
    bytes32 private constant _I_BGT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.iBgt")) - 1);
    bytes32 private constant _META_VAULT_IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.metavaultImplementation")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _METAVAULT_OPERATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.metavaultOperator")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _REWARD_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.rewardVault")) - 1);

    bytes32 private constant _ACCOUNT_TO_META_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.accountToMetavault")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _ACCOUNT_TO_DEFAULT_TYPE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.accountToDefaultType")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _META_VAULT_TO_ACCOUNT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.metavaultToAccount")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _VAULT_TO_META_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultToMetavault")) - 1); // solhint-disable-line max-line-length

    // ================================================
    // ================== Initializer =================
    // ================================================

    function initialize(
        address _bgt,
        address _iBgt,
        address _metavaultImplementation,
        address _metavaultOperator,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetBgt(_bgt);
        _ownerSetIBgt(_iBgt);
        _ownerSetMetavaultImplementation(_metavaultImplementation);
        _ownerSetMetavaultOperator(_metavaultOperator);
        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    // ================================================
    // ================ Public Functions ==============
    // ================================================

    function createMetavault(
        address _account,
        address _vault
    ) external override onlyDolomiteMarginGlobalOperator(msg.sender) returns (address) {
        IIsolationModeVaultFactory factory = IIsolationModeVaultFactory(msg.sender);
        /*assert(factory.isIsolationAsset());*/
        /*assert(factory.getAccountByVault(_vault) == _account);*/

        address metavault = getAccountToMetavault(_account);
        if (metavault == address(0)) {
            metavault = _createMetavault(_account);
        }
        _setAddressInMap(_VAULT_TO_META_VAULT_SLOT, _vault, metavault);

        return metavault;
    }

    /**
     *
     * @param  _type The default type to set
     *
     * @dev If called by a user, it sets the default type for msg.sender. If called by a metavault,
     * it sets the default type for the metavault's account.
     */
    function setAccountToAssetToDefaultType(address _asset, RewardVaultType _type) external {
        // @follow-up @Corey, please double check this logic
        address account = getMetavaultToAccount(msg.sender);
        if (account == address(0)){
            account = msg.sender;
        }

        address metavault = getAccountToMetavault(account);
        if (IERC20(rewardVault(_asset, getAccountToAssetToDefaultType(account, _asset))).balanceOf(metavault) == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            IERC20(rewardVault(_asset, getAccountToAssetToDefaultType(account, _asset))).balanceOf(metavault) == 0,
            _FILE,
            "Default type not empty"
        );
        _setUint256InNestedMap(_ACCOUNT_TO_DEFAULT_TYPE_SLOT, account, _asset, uint256(_type));
        emit AccountToAssetToDefaultTypeSet(account, _asset, _type);
    }


    // ================================================
    // ================ Admin Functions ===============
    // ================================================

    function ownerSetBgt(address _bgt) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetBgt(_bgt);
    }

    function ownerSetIBgt(address _iBgt) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetIBgt(_iBgt);
    }

    function ownerSetMetavaultImplementation(
        address _metavaultImplementation
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMetavaultImplementation(_metavaultImplementation);
    }

    function ownerSetMetavaultOperator(
        address _metavaultOperator
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMetavaultOperator(_metavaultOperator);
    }


    function ownerSetRewardVault(
        address _asset,
        RewardVaultType _type,
        address _rewardVault
    ) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRewardVault(_asset, _type, _rewardVault);
    }

    // ===================================================
    // ================== View Functions =================
    // ===================================================

    function bgt() external view override returns (IBGT) {
        return IBGT(_getAddress(_BGT_SLOT));
    }

    function iBgt() external view override returns (IERC20) {
        return IERC20(_getAddress(_I_BGT_SLOT));
    }

    function metavaultImplementation() external view override returns (address) {
        return _getAddress(_META_VAULT_IMPLEMENTATION_SLOT);
    }

    function metavaultOperator() external view override returns (IMetavaultOperator) {
        return IMetavaultOperator(_getAddress(_METAVAULT_OPERATOR_SLOT));
    }

    function calculateMetavaultByAccount(address _account) external view override returns (address) {
        return Create2.computeAddress(
            keccak256(abi.encodePacked(_account)),
            keccak256(type(MetavaultUpgradeableProxy).creationCode)
        );
    }

    function rewardVault(address _asset, RewardVaultType _type) public view override returns (address) {
        return _getAddressInNestedMap(_REWARD_VAULT_SLOT, _asset, uint256(_type));
    }

    function getAccountToAssetToDefaultType(
        address _account,
        address _asset
    ) public view override returns (RewardVaultType) {
        return RewardVaultType(_getUint256InNestedMap(_ACCOUNT_TO_DEFAULT_TYPE_SLOT, _account, _asset));
    }

    function getAccountToMetavault(address _account) public view override returns (address) {
        return _getAddressFromMap(_ACCOUNT_TO_META_VAULT_SLOT, _account);
    }

    function getMetavaultToAccount(address _metavault) public view override returns (address) {
        return _getAddressFromMap(_META_VAULT_TO_ACCOUNT_SLOT, _metavault);
    }

    function getVaultToMetavault(address _vault) public view override returns (address) {
        return _getAddressFromMap(_VAULT_TO_META_VAULT_SLOT, _vault);
    }

    // ================================================
    // =============== Internal Functions =============
    // ================================================

    function _createMetavault(address _account) internal returns (address) {
        address metavault = Create2.deploy(
            /* amount = */ 0,
            keccak256(abi.encodePacked(_account)),
            type(MetavaultUpgradeableProxy).creationCode
        );
        /*assert(metavault != address(0));*/
        emit MetavaultCreated(_account, metavault);

        _setAddressInMap(_META_VAULT_TO_ACCOUNT_SLOT, metavault, _account);
        _setAddressInMap(_ACCOUNT_TO_META_VAULT_SLOT, _account, metavault);
        _initializeVault(metavault, _account);

        return metavault;
    }

    function _initializeVault(address _metavault, address _account) internal {
        /*assert(_metavault != address(0) && _account != address(0));*/
        IMetavaultUpgradeableProxy(_metavault).initialize(_account);
    }

    function _ownerSetBgt(address _bgt) internal {
        if (_bgt != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _bgt != address(0),
            _FILE,
            "Invalid BGT address"
        );
        _setAddress(_BGT_SLOT, _bgt);
        emit BgtSet(_bgt);
    }

    function _ownerSetIBgt(address _iBgt) internal {
        if (_iBgt != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _iBgt != address(0),
            _FILE,
            "Invalid iBGT address"
        );
        _setAddress(_I_BGT_SLOT, _iBgt);
        emit IBgtSet(_iBgt);
    }

    function _ownerSetMetavaultImplementation(address _metavaultImplementation) internal {
        if (_metavaultImplementation != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _metavaultImplementation != address(0),
            _FILE,
            "Invalid implementation address"
        );
        _setAddress(_META_VAULT_IMPLEMENTATION_SLOT, _metavaultImplementation);
        emit MetavaultImplementationSet(_metavaultImplementation);
    }

    function _ownerSetMetavaultOperator(address _metavaultOperator) internal {
        if (_metavaultOperator != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _metavaultOperator != address(0),
            _FILE,
            "Invalid operator address"
        );
        _setAddress(_METAVAULT_OPERATOR_SLOT, _metavaultOperator);
        emit MetavaultOperatorSet(_metavaultOperator);
    }

    function _ownerSetRewardVault(address _asset, RewardVaultType _type, address _rewardVault) internal {
        if (_rewardVault != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _rewardVault != address(0),
            _FILE,
            "Invalid rewardVault address"
        );
        _setAddressInNestedMap(_REWARD_VAULT_SLOT, _asset, uint256(_type), _rewardVault);
        emit RewardVaultSet(_asset, _type, _rewardVault);
    }
}
