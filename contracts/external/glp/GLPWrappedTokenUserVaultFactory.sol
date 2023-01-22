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

import { IGLPRewardRouterV2 } from "../interfaces/IGLPRewardRouterV2.sol";
import { IGLPWrappedTokenUserVaultFactory } from "../interfaces/IGLPWrappedTokenUserVaultFactory.sol";

import { WrappedTokenUserVaultFactory } from "../proxies/WrappedTokenUserVaultFactory.sol";


/**
 * @title   GLPWrappedTokenUserVaultFactory
 * @author  Dolomite
 *
 * @notice  Concrete implementation of the WrappedTokenUserVaultFactory contract for GMX's sGLP token
 */
contract GLPWrappedTokenUserVaultFactory is
    IGLPWrappedTokenUserVaultFactory,
    WrappedTokenUserVaultFactory
{
    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrappedTokenUserVaultFactory";

    // ============ Field Variables ============

    IGLPRewardRouterV2 public override glpRewardsRouter;

    // ============ Constructor ============

    constructor(
        address _glpRewardsRouter,
        address _underlyingToken,
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    WrappedTokenUserVaultFactory(
        _underlyingToken,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        glpRewardsRouter = IGLPRewardRouterV2(_glpRewardsRouter);
    }

    // ============ External Functions ============

    function setGlpRewardsRouter(address _glpRewardsRouter) external override onlyOwner {
        glpRewardsRouter = IGLPRewardRouterV2(_glpRewardsRouter);
        emit GlpRewardsRouterSet(_glpRewardsRouter);
    }

    function allowablePositionMarketIds() external pure returns (uint256[] memory) {
        return new uint256[](0);
    }
}
