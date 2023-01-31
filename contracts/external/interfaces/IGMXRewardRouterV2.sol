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
 * @dev Interface of the GMX Reward Router V2 contract, taken from:
 *      https://arbiscan.io/address/0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1#code
 */
interface IGMXRewardRouterV2 {

    function handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldConvertWethToEth
    ) external;

    function stakeGmx(uint256 _amount) external;

    function unstakeGmx(uint256 _amount) external;

    function stakeEsGmx(uint256 _amount) external;

    function unstakeEsGmx(uint256 _amount) external;
}
