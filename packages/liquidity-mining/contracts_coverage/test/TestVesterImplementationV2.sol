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

import { SafeDelegateCallLib } from "@dolomite-exchange/modules-base/contracts/lib/SafeDelegateCallLib.sol";
import { IWETH } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IWETH.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { VesterImplementationV2 } from "../VesterImplementationV2.sol";


/**
 * @title   TestVesterImplementationV2
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestVesterImplementationV2 is VesterImplementationV2 {

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        IWETH _weth,
        IERC20 _arb
    ) VesterImplementationV2(
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
        SafeDelegateCallLib.safeDelegateCall(
            address(this),
            abi.encodeWithSelector(
                this.closePositionAndBuyTokens.selector,
                _id,
                _fromAccountNumber,
                _toAccountNumber,
                _maxPaymentAmount
            )
        );
    }

    function nextNftId() external view returns (uint256) {
        return _nextNftId();
    }

    function nextRequestId() external view returns (uint256) {
        return _nextRequestId();
    }
}
