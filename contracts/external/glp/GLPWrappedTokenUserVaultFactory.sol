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

import { IGMXRewardRouterV2 } from "../interfaces/IGMXRewardRouterV2.sol";
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

    address public immutable override WETH; // solhint-disable-line var-name-mixedcase
    uint256 public immutable override WETH_MARKET_ID; // solhint-disable-line var-name-mixedcase

    IGMXRewardRouterV2 public override gmxRewardsRouter;
    address public override gmx;
    address public override esGmx;
    address public override sGlp;
    address public override vGlp;

    // ============ Constructor ============

    constructor(
        address _weth,
        uint256 _wethMarketId,
        address _gmxRewardsRouter,
        address _gmx,
        address _esGmx,
        address _sGlp,
        address _vGlp,
        address _fsGlp, // this serves as the underlying token
        address _borrowPositionProxy,
        address _userVaultImplementation,
        address _dolomiteMargin
    )
    WrappedTokenUserVaultFactory(
        _fsGlp,
        _borrowPositionProxy,
        _userVaultImplementation,
        _dolomiteMargin
    ) {
        WETH = _weth;
        WETH_MARKET_ID = _wethMarketId;
        gmxRewardsRouter = IGMXRewardRouterV2(_gmxRewardsRouter);
        gmx = _gmx;
        esGmx = _esGmx;
        sGlp = _sGlp;
        vGlp = _vGlp;
    }

    // ============ External Functions ============

    function setGmx(address _gmx) external override onlyOwner(msg.sender) {
        gmx = _gmx;
        emit GmxSet(_gmx);
    }

    function setEsGmx(address _esGmx) external override onlyOwner(msg.sender) {
        esGmx = _esGmx;
        emit EsGmxSet(_esGmx);
    }

    function setSGlp(address _sGlp) external override onlyOwner(msg.sender) {
        sGlp = _sGlp;
        emit SGlpSet(_sGlp);
    }

    function setVGlp(address _vGlp) external override onlyOwner(msg.sender) {
        vGlp = _vGlp;
        emit VGlpSet(_vGlp);
    }

    function setGmxRewardsRouter(address _gmxRewardsRouter) external override onlyOwner(msg.sender) {
        gmxRewardsRouter = IGMXRewardRouterV2(_gmxRewardsRouter);
        emit GmxRewardsRouterSet(_gmxRewardsRouter);
    }

    function allowablePositionMarketIds() external pure returns (uint256[] memory) {
        return new uint256[](0);
    }
}
