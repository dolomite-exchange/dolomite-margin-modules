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

import { IMantlePauser } from "./IMantlePauser.sol";


/**
 * @title   IMantleRewardStation
 * @author  Dolomite
 *
 * @notice  This interface defines the functions that are available on the Mantle Rewards station contract
 *          (https://mantlescan.xyz/address/0xed884f0460a634c69dbb7def54858465808aacef).
 */
interface IMantleRewardStation {

    function deposit(uint256 _assets) external payable;

    function withdraw(uint256 _assets, address _receiver) external;

    function deposited(address _user) external view returns (uint256);

    function userStakeCooldown(address _user) external view returns (bool _hasCooldown, uint256 _cooldownTime);

    function pauser() external view returns (IMantlePauser);

    function minStake() external view returns (uint256);

    function cooldown() external view returns (uint256);
}
