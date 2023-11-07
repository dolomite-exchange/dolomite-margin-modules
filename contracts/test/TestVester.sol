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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Vester } from "../external/liquidityMining/Vester.sol";
import { IWETH } from "../protocol/interfaces/IWETH.sol";


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
        IWETH _weth,
        IERC20 _arb
    ) Vester(
        _dolomiteMargin,
        _dolomiteRegistry,
        _weth,
        _arb
    ) {} // solhint-disable-line

    function callClosePositionAndBuyTokensAndTriggerReentrancy(
        uint256 _id,
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _maxPaymentAmount
    ) external payable nonReentrant {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.closePositionAndBuyTokens.selector,
                _id,
                _fromAccountNumber,
                _toAccountNumber,
                _maxPaymentAmount
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
