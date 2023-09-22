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

import { IUmamiWithdrawalQueuer } from "../external/interfaces/umami/IUmamiWithdrawalQueuer.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title   TestUmamiWithdrawalQueuer
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestUmamiWithdrawalQueuer is IUmamiWithdrawalQueuer {

    bytes32 private constant _FILE = "TestUmamiWithdrawalQueuer";

    uint256 public nonce;

    function queueRedeem(address vault, uint256 amount) external returns (bytes32) {
        IERC20(vault).transferFrom(msg.sender, address(this), amount);
        nonce++;
        return keccak256(abi.encode(msg.sender, nonce));
    }

    function queueRedeemImmediate(address vault, uint256 amount) external returns (bytes32) {
        IERC20(vault).transferFrom(msg.sender, address(this), amount);
        nonce++;
        return keccak256(abi.encode(msg.sender, nonce));
    }
}
