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

import { ICustomTestToken } from "./ICustomTestToken.sol";
import { IDolomiteTransformer } from "../interfaces/IDolomiteTransformer.sol";

import "hardhat/console.sol";

/**
 * @title   TestFailingTransformer
 * @author  Dolomite
 *
 * @notice  Test contract for a transformer implementation
 */
contract TestFailingTransformer {

    ICustomTestToken public immutable tokenFrom;
    address public immutable outputToken;

    constructor(address _tokenFrom, address _tokenTo) {
        tokenFrom = ICustomTestToken(_tokenFrom);
        outputToken = _tokenTo;
    }

    function transform(uint256 amount, bytes calldata /* _extraData */) external returns (uint256) {
        revert("Call failed");
    }
}

contract TestFailingTransformerBytes {
    ICustomTestToken public immutable tokenFrom;
    address public immutable outputToken;

    constructor(address _tokenFrom, address _tokenTo) {
        tokenFrom = ICustomTestToken(_tokenFrom);
        outputToken = _tokenTo;
    }

    function transform(uint256 amount, bytes calldata /* _extraData */) external returns (bytes memory) {
        return abi.encode(amount, amount);
    }
}
