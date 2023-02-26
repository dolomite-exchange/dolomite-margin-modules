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


/**
 * @title   IGLPRewardsRouterV2
 * @author  Dolomite
 *
 * @notice  Interface of the GMX Reward Router V2 contract, taken from:
 *          https://arbiscan.io/address/0xB95DB5B167D75e6d04227CfFFA61069348d271F5#code
 */
interface IGLPRewardsRouterV2 {

    function mintAndStakeGlp(
        address _token,
        uint256 _amount,
        uint256 _minUsdg,
        uint256 _minGlp
    ) external returns (uint256);

    function unstakeAndRedeemGlp(
        address _tokenOut,
        uint256 _glpAmount,
        uint256 _minAmountOut,
        address _receiver
    ) external returns (uint256);
}
