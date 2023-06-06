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
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IGLPManager } from "../interfaces/gmx/IGLPManager.sol";
import { IGLPRewardsRouterV2 } from "../interfaces/gmx/IGLPRewardsRouterV2.sol";
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
contract GmxRegistryV1 is IGmxRegistryV1, OnlyDolomiteMargin {

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

    bytes32 private constant _FILE = "GmxRegistryV1";

    // ============ Field Variables ============

    address public override esGmx;
    IERC20 public override fsGlp;
    IERC20 public override glp;
    IGLPManager public override glpManager;
    IGLPRewardsRouterV2 public override glpRewardsRouter;
    IERC20 public override gmx;
    IGmxRewardRouterV2 public override gmxRewardsRouter;
    IGmxVault public override gmxVault;
    address public override sGlp;
    address public override sGmx;
    address public override sbfGmx;
    address public override vGlp;
    address public override vGmx;

    // ============ Constructor ============

    constructor(
        Initializer memory _initializer,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        esGmx = _initializer.esGmx;
        fsGlp = IERC20(_initializer.fsGlp);
        glp = IERC20(_initializer.glp);
        glpManager = IGLPManager(_initializer.glpManager);
        glpRewardsRouter = IGLPRewardsRouterV2(_initializer.glpRewardsRouter);
        gmx = IERC20(_initializer.gmx);
        gmxRewardsRouter = IGmxRewardRouterV2(_initializer.gmxRewardsRouter);
        gmxVault = IGmxVault(_initializer.gmxVault);
        sGlp = _initializer.sGlp;
        sGmx = _initializer.sGmx;
        sbfGmx = _initializer.sbfGmx;
        vGlp = _initializer.vGlp;
        vGmx = _initializer.vGmx;
    }

    // ============ External Functions ============

    function ownerSetEsGmx(address _esGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _esGmx != address(0),
            _FILE,
            "Invalid esGmx address"
        );
        esGmx = _esGmx;
        emit EsGmxSet(_esGmx);
    }

    function ownerSetFSGlp(address _fsGlp) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _fsGlp != address(0),
            _FILE,
            "Invalid fsGlp address"
        );
        fsGlp = IERC20(_fsGlp);
        emit FSGlpSet(_fsGlp);
    }

    function ownerSetGlp(address _glp) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _glp != address(0),
            _FILE,
            "Invalid glp address"
        );
        glp = IERC20(_glp);
        emit GlpSet(_glp);
    }

    function ownerSetGlpManager(address _glpManager) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _glpManager != address(0),
            _FILE,
            "Invalid glpManager address"
        );
        glpManager = IGLPManager(_glpManager);
        emit GlpManagerSet(_glpManager);
    }

    function ownerSetGlpRewardsRouter(address _glpRewardsRouter) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _glpRewardsRouter != address(0),
            _FILE,
            "Invalid glpRewardsRouter address"
        );
        glpRewardsRouter = IGLPRewardsRouterV2(_glpRewardsRouter);
        emit GlpRewardsRouterSet(_glpRewardsRouter);
    }

    function ownerSetGmx(address _gmx) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _gmx != address(0),
            _FILE,
            "Invalid gmx address"
        );
        gmx = IERC20(_gmx);
        emit GmxSet(_gmx);
    }

    function ownerSetGmxRewardsRouter(address _gmxRewardsRouter) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _gmxRewardsRouter != address(0),
            _FILE,
            "Invalid gmxRewardsRouter address"
        );
        gmxRewardsRouter = IGmxRewardRouterV2(_gmxRewardsRouter);
        emit GmxRewardsRouterSet(_gmxRewardsRouter);
    }

    function ownerSetGmxVault(address _gmxVault) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _gmxVault != address(0),
            _FILE,
            "Invalid gmxVault address"
        );
        gmxVault = IGmxVault(_gmxVault);
        emit GmxVaultSet(_gmxVault);
    }

    function ownerSetSGlp(address _sGlp) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _sGlp != address(0),
            _FILE,
            "Invalid sGlp address"
        );
        sGlp = _sGlp;
        emit SGlpSet(_sGlp);
    }

    function ownerSetSGmx(address _sGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _sGmx != address(0),
            _FILE,
            "Invalid sGmx address"
        );
        sGmx = _sGmx;
        emit SGmxSet(_sGmx);
    }

    function ownerSetSbfGmx(address _sbfGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _sbfGmx != address(0),
            _FILE,
            "Invalid sbfGmx address"
        );
        sbfGmx = _sbfGmx;
        emit SbfGmxSet(_sbfGmx);
    }

    function ownerSetVGlp(address _vGlp) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _vGlp != address(0),
            _FILE,
            "Invalid vGlp address"
        );
        vGlp = _vGlp;
        emit VGlpSet(_vGlp);
    }

    function ownerSetVGmx(address _vGmx) external override onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _vGmx != address(0),
            _FILE,
            "Invalid vGmx address"
        );
        vGmx = _vGmx;
        emit VGmxSet(_vGmx);
    }
}
