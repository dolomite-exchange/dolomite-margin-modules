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

import { IJonesUSDCFarm } from "../external/interfaces/jones/IJonesUSDCFarm.sol";


/**
 * @title   TestJonesUSDCFarm
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestJonesUSDCFarm is IJonesUSDCFarm {

    bytes32 private constant _FILE = "TestJonesUSDCFarm";

    // solhint-disable-next-line no-empty-blocks
    function deposit(uint256, uint256, address) external {}

    // solhint-disable-next-line no-empty-blocks
    function withdraw(uint256, uint256, address) external {}

    // solhint-disable-next-line no-empty-blocks
    function harvest(uint256, address) external {}

    function pendingSushi(uint256, address) external view returns (uint256) {
        return 0;
    }
    function incentivesOn() external view returns (bool) {
        return false;
    }
    function incentiveReceiver() external view returns (address) {
        return address(0);
    }

    function poolInfo(uint256) external view returns (PoolInfo memory p) {
        return p;
    }

    function userInfo(uint256, address) external view returns (UserInfo memory u) {
        return u;
    }
}
