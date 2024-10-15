// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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


/**
 * @title   IBGT
 * @author  Dolomite
 *
 */
interface IBGT is IERC20 {

    struct QueuedBoost {
        uint32 blockNumberLast;
        uint128 balance;
    }

    function redeem(address receiver, uint256 amount) external;

    function delegate(address delegatee) external;

    function queueBoost(address validator, uint128 amount) external;

    function cancelBoost(address validator, uint128 amount) external;

    function activateBoost(address validator) external;

    function dropBoost(address validator, uint128 amount) external;

    function delegates(address account) external view returns (address);

    function boosts(address account) external view returns (uint128);

    function queuedBoost(address account) external view returns (uint128);

    function unboostedBalanceOf(address account) external view returns (uint256);

    function boostedQueue(address account, address validator) external view returns (QueuedBoost memory);
}
