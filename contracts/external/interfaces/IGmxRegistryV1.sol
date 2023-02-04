// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;


import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IGLPManager } from "../interfaces/IGLPManager.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxRewardRouterV2 } from "../interfaces/IGmxRewardRouterV2.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";


interface IGmxRegistryV1 {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event EsGmxSet(address _esGmx);
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

    function esGmx() external view returns (address);

    function glp() external view returns (IERC20);

    function glpManager() external view returns (IGLPManager);

    function glpRewardsRouter() external view returns (IGmxRewardRouterV2);

    function gmx() external view returns (IERC20);

    function gmxRewardsRouter() external view returns (IGmxRewardRouterV2);

    function gmxVault() external view returns (IGmxVault);

    function sGlp() external view returns (address);

    function sGmx() external view returns (address);

    function sbfGmx() external view returns (address);

    function vGlp() external view returns (address);

    function vGmx() external view returns (address);

    function setEsGmx(address _esGmx) external;

    function setGlp(address _glp) external;

    function setGlpManager(address _glpManager) external;

    function setGlpRewardsRouter(address _glpRewardsRouter) external;

    function setGmx(address _gmx) external;

    function setGmxRewardsRouter(address _gmxRewardsRouter) external;

    function setGmxVault(address _gmxVault) external;

    function setSGlp(address _sGlp) external;

    function setSGmx(address _sGmx) external;

    function setSbfGmx(address _sbfGmx) external;

    function setVGlp(address _vGlp) external;

    function setVGmx(address _vGmx) external;
}
