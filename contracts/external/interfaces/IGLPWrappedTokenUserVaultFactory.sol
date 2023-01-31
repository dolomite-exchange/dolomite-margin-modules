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

import { IGMXRewardRouterV2 } from "./IGMXRewardRouterV2.sol";
import { IWrappedTokenUserVaultFactory } from "./IWrappedTokenUserVaultFactory.sol";


interface IGLPWrappedTokenUserVaultFactory is IWrappedTokenUserVaultFactory {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event GmxRewardsRouterSet(address _gmxRewardsRouter);
    event GmxSet(address _gmx);
    event EsGmxSet(address _esGmx);
    event SGlpSet(address _vGlp);
    event VGlpSet(address _vGlp);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function setGmxRewardsRouter(address _gmxRewardsRouter) external;

    function setGmx(address _gmx) external;

    function setEsGmx(address _esGmx) external;

    function setSGlp(address _sGlp) external;

    function setVGlp(address _vGlp) external;

    function WETH() external view returns (address);

    function WETH_MARKET_ID() external view returns (uint256);

    function esGmx() external view returns (address);

    function gmx() external view returns (address);

    function sGlp() external view returns (address);

    function vGlp() external view returns (address);

    function gmxRewardsRouter() external view returns (IGMXRewardRouterV2);
}
