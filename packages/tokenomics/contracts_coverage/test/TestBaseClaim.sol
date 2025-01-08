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

import { BaseClaim } from "../BaseClaim.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";


/**
 * @title   TestBaseClaim
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestBaseClaim is BaseClaim {

    bytes32 private constant _FILE = "TestBaseClaim";

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) BaseClaim(
        _dolomiteRegistry,
        _dolomiteMargin
    ) {} // solhint-disable-line

    function verifyMerkleProof(bytes32[] calldata _proof, uint256 _amount) external view returns (bool){
        address user = addressRemapping[msg.sender] == address(0) ? msg.sender : addressRemapping[msg.sender];
        if (_verifyMerkleProof(user, _proof, _amount)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _verifyMerkleProof(user, _proof, _amount),
            _FILE,
            "Invalid merkle proof"
        );
        return true;
    }
}
