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
import { IVeToken } from "../interfaces/IVeToken.sol";


/**
 * @title   TestVeToken
 * @author  Dolomite
 *
 * Test implementation for IVeToken
 */
contract TestVeToken is IVeToken {

    IERC20 public token;
    uint256 public amount;
    uint256 public end;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function increase_amount(uint256 /* _id */, uint256 _amount) external {
        token.transferFrom(msg.sender, address(this), _amount);
    }

    function setAmountAndEnd(uint256 _amount, uint256 _end) external {
        amount = _amount;
        end = _end;
    }

    function locked(uint256 /* _veNftId */) external view override returns (LockedBalance memory) {
        return LockedBalance({
            amount: amount,
            end: end
        });
    }

    function create_lock(uint256 _value, uint256 /* _lock_duration */) external override returns (uint256) {
        token.transferFrom(msg.sender, address(this), _value);
        return 0;
    }

    function create_lock_for(
        uint256 _value,
        uint256 /* _lock_duration */,
        address /* _for */
    ) external override returns (uint256) {
        token.transferFrom(msg.sender, address(this), _value);
        return 0;
    }

    function ownerOf(uint256 /* _veNftId */) external view returns (address) {
        return msg.sender;
    }
}
