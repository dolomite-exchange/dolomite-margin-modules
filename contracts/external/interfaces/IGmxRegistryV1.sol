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
import { IGLPRewardsRouterV2 } from "./IGLPRewardsRouterV2.sol";
import { IGLPManager } from "../interfaces/IGLPManager.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxRewardRouterV2 } from "../interfaces/IGmxRewardRouterV2.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";


/**
 * @title   IGmxRegistryV1
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the different addresses that can interact with the GMX ecosystem
 */
interface IGmxRegistryV1 {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event EsGmxSet(address _esGmx);
    event FSGlpSet(address _fsGlp);
    event GlpSet(address _glp);
    event GlpManagerSet(address _glpManager);
    event GlpRewardsRouterSet(address _glpRewardsRouter);
    event GmxSet(address _gmx);
    event GmxRewardsRouterSet(address _gmxRewardsRouter);
    event GmxVaultSet(address _gmxVaultSet);
    event SGlpSet(address _sGlp);
    event SGmxSet(address _sGmx);
    event SbfGmxSet(address _sbfGmx);
    event VGlpSet(address _vGlp);
    event VGmxSet(address _vGmx);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetEsGmx(address _esGmx) external;

    function ownerSetFSGlp(address _fsGlp) external;

    function ownerSetGlp(address _glp) external;

    function ownerSetGlpManager(address _glpManager) external;

    function ownerSetGlpRewardsRouter(address _glpRewardsRouter) external;

    function ownerSetGmx(address _gmx) external;

    function ownerSetGmxRewardsRouter(address _gmxRewardsRouter) external;

    function ownerSetGmxVault(address _gmxVault) external;

    function ownerSetSGlp(address _sGlp) external;

    function ownerSetSGmx(address _sGmx) external;

    function ownerSetSbfGmx(address _sbfGmx) external;

    function ownerSetVGlp(address _vGlp) external;

    function ownerSetVGmx(address _vGmx) external;

    function esGmx() external view returns (address);

    function fsGlp() external view returns (IERC20);

    function glp() external view returns (IERC20);

    function glpManager() external view returns (IGLPManager);

    function glpRewardsRouter() external view returns (IGLPRewardsRouterV2);

    function gmx() external view returns (IERC20);

    function gmxRewardsRouter() external view returns (IGmxRewardRouterV2);

    function gmxVault() external view returns (IGmxVault);

    function sGlp() external view returns (address);

    function sGmx() external view returns (address);

    function sbfGmx() external view returns (address);

    function vGlp() external view returns (address);

    function vGmx() external view returns (address);
}
