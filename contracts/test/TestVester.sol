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

import { IOARB } from "../external/interfaces/liquidityMining/IOARB.sol";
import { Vester } from "../external/liquidityMining/Vester.sol";


/**
 * @title   TestVester
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestVester is Vester {

    bytes32 private constant _FILE = "TestVester";

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        uint256 _wethMarketId,
        uint256 _arbMarketId,
        IOARB _oARB
    ) Vester(
        _dolomiteMargin,
        _dolomiteRegistry,
        _wethMarketId,
        _arbMarketId,
        _oARB
    ) {} // solhint-disable-line

    function callClosePositionAndBuyTokensAndTriggerReentrancy(
        uint256 _id
    ) external payable nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSignature(
                "closePositionAndBuyTokens(uint256)",
                _id
            )
        );
        if (!isSuccessful) {
            if (result.length < 68) {
                revert("No reversion message!");
            } else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    result := add(result, 0x04) // Slice the sighash.
                }
            }
            (string memory errorMessage) = abi.decode(result, (string));
            revert(errorMessage);
        }
    }
}
