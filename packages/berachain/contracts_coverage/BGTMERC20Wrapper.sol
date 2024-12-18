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

import { MinimalERC20 } from "@dolomite-exchange/modules-base/contracts/general/MinimalERC20.sol";
import { IBGTM } from "./interfaces/IBGTM.sol";


/**
 * @title   BGTMERC20Wrapper
 * @author  Dolomite
 *
 * @notice  Simple ERC20 wrapper for BGM. Most functionality is restricted
 */
contract BGTMERC20Wrapper is MinimalERC20 {

    IBGTM public immutable bgtm;

    constructor(address _bgtm) MinimalERC20("BGT Market", "BGT.m", 18) {
        bgtm = IBGTM(_bgtm);
    }

    function transfer(address /* to */, uint256 /* amount */) public override returns (bool) {
        revert("Not implemented");
    }

    function approve(address /* spender */, uint256 /* amount */) public override returns (bool) {
        revert("Not implemented");
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public override returns (bool) {
        revert("Not implemented");
    }

    function totalSupply() public view override returns (uint256) {
        revert("Not implemented");
    }

    function allowance(address /* owner */, address /* spender */) public view override returns (uint256) {
        revert("Not implemented");
    }

    function balanceOf(address account) public view override returns (uint256) {
        return bgtm.getBalance(account);
    }
}
