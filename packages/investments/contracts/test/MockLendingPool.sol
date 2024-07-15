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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title   MockLendingPool
 * @author  Dolomite
 *
 * @notice  
 */
contract MockLendingPool {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "MockLendingPool";

    IERC20 public immutable token;
    uint256 public immutable initialTimestamp;
    mapping(address => uint256) public balances;

    constructor(address _token) {
        token = IERC20(_token);
        initialTimestamp = block.timestamp;
    }

    function deposit(uint256 _amount) external {
        token.transferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;
    }

    function withdraw(uint256 _amount) external {
        Require.that(
            balanceOf(msg.sender) >= _amount,
            _FILE,
            "Insufficient balance"
        );
        balances[msg.sender] -= _amount;
        token.transfer(msg.sender, _amount);
    }

    function balanceOf(address _account) public view returns (uint256) {
        return balances[_account] * (block.timestamp - initialTimestamp) / 1000;
    }
}
