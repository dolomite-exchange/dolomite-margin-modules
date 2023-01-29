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

import { IGLPRewardRouterV2 } from "./IGLPRewardRouterV2.sol";
import { IWrappedTokenUserVaultFactory } from "./IWrappedTokenUserVaultFactory.sol";


interface IGLPWrappedTokenUserVaultFactory is IWrappedTokenUserVaultFactory {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event GlpRewardsRouterSet(address _glpRewardsRouter);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function setGlpRewardsRouter(address _glpRewardsRouter) external;

    function WETH() external pure returns (address);

    function WETH_MARKET_ID() external pure returns (uint256);

    function GMX() external view returns (IGLPRewardRouterV2);

    function ES_GMX() external view returns (IGLPRewardRouterV2);

    function glpRewardsRouter() external view returns (IGLPRewardRouterV2);
}
