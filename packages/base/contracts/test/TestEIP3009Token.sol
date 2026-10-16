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

import { CustomTestToken } from "./CustomTestToken.sol";
import { IERC20WithAuthorization } from "../interfaces/IERC20WithAuthorization.sol";


/**
 * @title   TestEIP3009Token
 * @author  Dolomite
 *
 * @notice  Test token that supports EIP-3009 authorization methods for testing.
 */
contract TestEIP3009Token is CustomTestToken, IERC20WithAuthorization {

    mapping(bytes32 => bool) public isNonceUsed;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) CustomTestToken(name_, symbol_, decimals_) {}

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 /* v */,
        bytes32 /* r */,
        bytes32 /* s */
    ) external override {
        require(block.timestamp >= validAfter, "EIP3009: not yet valid");
        require(block.timestamp <= validBefore, "EIP3009: expired");
        require(!isNonceUsed[nonce], "EIP3009: authorization already used");
        isNonceUsed[nonce] = true;
        _transfer(from, to, value);
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 /* v */,
        bytes32 /* r */,
        bytes32 /* s */
    ) external override {
        require(block.timestamp >= validAfter, "EIP3009: not yet valid");
        require(block.timestamp <= validBefore, "EIP3009: expired");
        require(!isNonceUsed[nonce], "EIP3009: authorization already used");
        isNonceUsed[nonce] = true;
        _transfer(from, to, value);
    }
}
