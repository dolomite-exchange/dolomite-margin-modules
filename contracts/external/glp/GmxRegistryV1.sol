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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { BaseRegistry } from "../general/BaseRegistry.sol";
import { IGLPManager } from "../interfaces/gmx/IGLPManager.sol";
import { IGLPRewardsRouterV2 } from "../interfaces/gmx/IGLPRewardsRouterV2.sol";
import { IGLPIsolationModeVaultFactory } from "../interfaces/gmx/IGLPIsolationModeVaultFactory.sol";
import { IGMXIsolationModeVaultFactory } from "../interfaces/gmx/IGMXIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "../interfaces/gmx/IGmxRegistryV1.sol";
import { IGmxRewardRouterV2 } from "../interfaces/gmx/IGmxRewardRouterV2.sol";
import { IGmxVault } from "../interfaces/gmx/IGmxVault.sol";


/**
 * @title   GmxRegistryV1
 * @author  Dolomite
 *
 * @notice  Implementation for a registry that contains all of the GMX-related addresses. This registry is needed to
 *          offer uniform access to addresses in an effort to keep Dolomite's contracts as up-to-date as possible
 *          without having to deprecate the system and force users to migrate (losing any vesting rewards / multiplier
 *          points) when Dolomite needs to point to new contracts or functions that GMX introduces.
 */
contract GmxRegistryV1 is IGmxRegistryV1, BaseRegistry {

    // ============ Structs ============

    struct Initializer {
        address esGmx;
        address fsGlp;
        address glp;
        address glpManager;
        address glpRewardsRouter;
        address gmx;
        address gmxRewardsRouter;
        address gmxVault;
        address sGlp;
        address sGmx;
        address sbfGmx;
        address vGlp;
        address vGmx;
    }

    // ============ Constants ============

    // solhint-disable max-line-length
    bytes32 private constant _FILE = "GmxRegistryV1";
    bytes32 private constant _ES_GMX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.esGmx")) - 1);
    bytes32 private constant _FS_GLP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.fsGlp")) - 1);
    bytes32 private constant _GLP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glp")) - 1);
    bytes32 private constant _GLP_MANAGER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glpManager")) - 1);
    bytes32 private constant _GLP_REWARDS_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glpRewardsRouter")) - 1);
    bytes32 private constant _GLP_VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.glpVaultFactory")) - 1);
    bytes32 private constant _GMX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmx")) - 1);
    bytes32 private constant _GMX_REWARDS_ROUTER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxRewardsRouter")) - 1);
    bytes32 private constant _GMX_VAULT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxVault")) - 1);
    bytes32 private constant _GMX_VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.gmxVaultFactory")) - 1);
    bytes32 private constant _S_GLP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.sGlp")) - 1);
    bytes32 private constant _S_GMX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.sGmx")) - 1);
    bytes32 private constant _SBF_GMX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.sbfGmx")) - 1);
    bytes32 private constant _V_GLP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vGlp")) - 1);
    bytes32 private constant _V_GMX_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vGmx")) - 1);
    // solhint-enable max-line-length

    // ============ Constructor ============

    function initialize(
        Initializer calldata _initializer,
        address _dolomiteRegistry
    ) external initializer {
        _ownerSetEsGmx(_initializer.esGmx);
        _ownerSetFSGlp(_initializer.fsGlp);
        _ownerSetGlp(_initializer.glp);
        _ownerSetGlpManager(_initializer.glpManager);
        _ownerSetGlpRewardsRouter(_initializer.glpRewardsRouter);
        _ownerSetGmx(_initializer.gmx);
        _ownerSetGmxRewardsRouter(_initializer.gmxRewardsRouter);
        _ownerSetGmxVault(_initializer.gmxVault);
        _ownerSetSGlp(_initializer.sGlp);
        _ownerSetSGmx(_initializer.sGmx);
        _ownerSetSbfGmx(_initializer.sbfGmx);
        _ownerSetVGlp(_initializer.vGlp);
        _ownerSetVGmx(_initializer.vGmx);

        _ownerSetDolomiteRegistry(_dolomiteRegistry);
    }

    // ============ External Functions ============

    function ownerSetEsGmx(address _esGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetEsGmx(_esGmx);
    }

    function ownerSetFSGlp(address _fsGlp) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetFSGlp(_fsGlp);
    }

    function ownerSetGlp(address _glp) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlp(_glp);
    }

    function ownerSetGlpManager(address _glpManager) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlpManager(_glpManager);
    }

    function ownerSetGlpRewardsRouter(address _glpRewardsRouter) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlpRewardsRouter(_glpRewardsRouter);
    }

    function ownerSetGlpVaultFactory(address _glpVaultFactory) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlpVaultFactory(_glpVaultFactory);
    }

    function ownerSetGmx(address _gmx) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmx(_gmx);
    }

    function ownerSetGmxRewardsRouter(address _gmxRewardsRouter) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxRewardsRouter(_gmxRewardsRouter);
    }

    function ownerSetGmxVault(address _gmxVault) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxVault(_gmxVault);
    }

    function ownerSetGmxVaultFactory(address _gmxVaultFactory) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGmxVaultFactory(_gmxVaultFactory);
    }

    function ownerSetSGlp(address _sGlp) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSGlp(_sGlp);
    }

    function ownerSetSGmx(address _sGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSGmx(_sGmx);
    }

    function ownerSetSbfGmx(address _sbfGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetSbfGmx(_sbfGmx);
    }

    function ownerSetVGlp(address _vGlp) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetVGlp(_vGlp);
    }

    function ownerSetVGmx(address _vGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetVGmx(_vGmx);
    }

    function esGmx() external view returns (address) {
        return _getAddress(_ES_GMX_SLOT);
    }

    function fsGlp() external view returns (IERC20) {
        return IERC20(_getAddress(_FS_GLP_SLOT));
    }

    function glp() external view returns (IERC20) {
        return IERC20(_getAddress(_GLP_SLOT));
    }

    function glpManager() external view returns (IGLPManager) {
        return IGLPManager(_getAddress(_GLP_MANAGER_SLOT));
    }

    function glpRewardsRouter() external view returns (IGLPRewardsRouterV2) {
        return IGLPRewardsRouterV2(_getAddress(_GLP_REWARDS_ROUTER_SLOT));
    }

    function glpVaultFactory() external view returns (IGLPIsolationModeVaultFactory) {
        return IGLPIsolationModeVaultFactory(_getAddress(_GLP_VAULT_FACTORY_SLOT));
    }

    function gmx() external view returns (IERC20) {
        return IERC20(_getAddress(_GMX_SLOT));
    }

    function gmxRewardsRouter() external view returns (IGmxRewardRouterV2) {
        return IGmxRewardRouterV2(_getAddress(_GMX_REWARDS_ROUTER_SLOT));
    }

    function gmxVault() external view returns (IGmxVault) {
        return IGmxVault(_getAddress(_GMX_VAULT_SLOT));
    }

    function gmxVaultFactory() external view returns (IGMXIsolationModeVaultFactory) {
        return IGMXIsolationModeVaultFactory(_getAddress(_GMX_VAULT_FACTORY_SLOT));
    }

    function sGlp() external view returns (address) {
        return _getAddress(_S_GLP_SLOT);
    }

    function sGmx() external view returns (address) {
        return _getAddress(_S_GMX_SLOT);
    }

    function sbfGmx() external view returns (address) {
        return _getAddress(_SBF_GMX_SLOT);
    }

    function vGlp() external view returns (address) {
        return _getAddress(_V_GLP_SLOT);
    }

    function vGmx() external view returns (address) {
        return _getAddress(_V_GMX_SLOT);
    }

    // ==================== Internal Functions =========================

    function _ownerSetEsGmx(address _esGmx) internal {
        Require.that(
            _esGmx != address(0),
            _FILE,
            "Invalid esGmx address"
        );
        _setAddress(_ES_GMX_SLOT, _esGmx);
        emit EsGmxSet(_esGmx);
    }

    function _ownerSetFSGlp(address _fsGlp) internal {
        Require.that(
            _fsGlp != address(0),
            _FILE,
            "Invalid fsGlp address"
        );
        _setAddress(_FS_GLP_SLOT, _fsGlp);
        emit FSGlpSet(_fsGlp);
    }

    function _ownerSetGlp(address _glp) internal {
        Require.that(
            _glp != address(0),
            _FILE,
            "Invalid glp address"
        );
        _setAddress(_GLP_SLOT, _glp);
        emit GlpSet(_glp);
    }

    function _ownerSetGlpManager(address _glpManager) internal {
        Require.that(
            _glpManager != address(0),
            _FILE,
            "Invalid glpManager address"
        );
        _setAddress(_GLP_MANAGER_SLOT, _glpManager);
        emit GlpManagerSet(_glpManager);
    }

    function _ownerSetGlpRewardsRouter(address _glpRewardsRouter) internal {
        Require.that(
            _glpRewardsRouter != address(0),
            _FILE,
            "Invalid glpRewardsRouter address"
        );
        _setAddress(_GLP_REWARDS_ROUTER_SLOT, _glpRewardsRouter);
        emit GlpRewardsRouterSet(_glpRewardsRouter);
    }

    function _ownerSetGlpVaultFactory(address _glpVaultFactory) internal {
        Require.that(
            _glpVaultFactory != address(0),
            _FILE,
            "Invalid glpVaultFactory address"
        );
        _setAddress(_GLP_VAULT_FACTORY_SLOT, _glpVaultFactory);
        emit GlpVaultFactorySet(_glpVaultFactory);
    }

    function _ownerSetGmx(address _gmx) internal {
        Require.that(
            _gmx != address(0),
            _FILE,
            "Invalid gmx address"
        );
        _setAddress(_GMX_SLOT, _gmx);
        emit GmxSet(_gmx);
    }

    function _ownerSetGmxRewardsRouter(address _gmxRewardsRouter) internal {
        Require.that(
            _gmxRewardsRouter != address(0),
            _FILE,
            "Invalid gmxRewardsRouter address"
        );
        _setAddress(_GMX_REWARDS_ROUTER_SLOT, _gmxRewardsRouter);
        emit GmxRewardsRouterSet(_gmxRewardsRouter);
    }

    function _ownerSetGmxVault(address _gmxVault) internal {
        Require.that(
            _gmxVault != address(0),
            _FILE,
            "Invalid gmxVault address"
        );
        _setAddress(_GMX_VAULT_SLOT, _gmxVault);
        emit GmxVaultSet(_gmxVault);
    }

    function _ownerSetGmxVaultFactory(address _gmxVaultFactory) internal {
        Require.that(
            _gmxVaultFactory != address(0),
            _FILE,
            "Invalid gmxVault address"
        );
        _setAddress(_GMX_VAULT_FACTORY_SLOT, _gmxVaultFactory);
        emit GmxVaultFactorySet(_gmxVaultFactory);
    }

    function _ownerSetSGlp(address _sGlp) internal {
        Require.that(
            _sGlp != address(0),
            _FILE,
            "Invalid sGlp address"
        );
        _setAddress(_S_GLP_SLOT, _sGlp);
        emit SGlpSet(_sGlp);
    }

    function _ownerSetSGmx(address _sGmx) internal {
        Require.that(
            _sGmx != address(0),
            _FILE,
            "Invalid sGmx address"
        );
        _setAddress(_S_GMX_SLOT, _sGmx);
        emit SGmxSet(_sGmx);
    }

    function _ownerSetSbfGmx(address _sbfGmx) internal {
        Require.that(
            _sbfGmx != address(0),
            _FILE,
            "Invalid sbfGmx address"
        );
        _setAddress(_SBF_GMX_SLOT, _sbfGmx);
        emit SbfGmxSet(_sbfGmx);
    }

    function _ownerSetVGlp(address _vGlp) internal {
        Require.that(
            _vGlp != address(0),
            _FILE,
            "Invalid vGlp address"
        );
        _setAddress(_V_GLP_SLOT, _vGlp);
        emit VGlpSet(_vGlp);
    }

    function _ownerSetVGmx(address _vGmx) internal {
        Require.that(
            _vGmx != address(0),
            _FILE,
            "Invalid vGmx address"
        );
        _setAddress(_V_GMX_SLOT, _vGmx);
        emit VGmxSet(_vGmx);
    }
}
