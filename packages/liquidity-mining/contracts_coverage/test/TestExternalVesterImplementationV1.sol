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
import { ExternalVesterImplementationV1 } from "../ExternalVesterImplementationV1.sol";


/**
 * @title   TestExternalVesterImplementationV1
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestExternalVesterImplementationV1 is ExternalVesterImplementationV1 {

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        IERC20 _pairToken,
        IERC20 _paymentToken,
        IERC20 _rewardToken
    ) ExternalVesterImplementationV1(
        _dolomiteMargin,
        _dolomiteRegistry,
        _pairToken,
        _paymentToken,
        _rewardToken
    ) {} // solhint-disable-line

    function callVestAndTriggerReentrancy(
        uint256 _duration,
        uint256 _oTokenAmount,
        uint256 _maxPairAmount
    ) external payable nonReentrant {
        SafeDelegateCallLib.safeDelegateCall(
            address(this),
            abi.encodeWithSelector(
                this.vest.selector,
                _duration,
                _oTokenAmount,
                _maxPairAmount
            )
        );
    }

    function callVestInstantlyAndTriggerReentrancy(
        uint256 _amount,
        uint256 _maxPaymentAmount
    ) external payable nonReentrant {
        SafeDelegateCallLib.safeDelegateCall(
            address(this),
            abi.encodeWithSelector(
                this.vestInstantly.selector,
                _amount,
                _maxPaymentAmount
            )
        );
    }

    function callClosePositionAndBuyTokensAndTriggerReentrancy(
        uint256 _id,
        uint256 _maxPaymentAmount
    ) external payable nonReentrant {
        SafeDelegateCallLib.safeDelegateCall(
            address(this),
            abi.encodeWithSelector(
                this.closePositionAndBuyTokens.selector,
                _id,
                _maxPaymentAmount
            )
        );
    }
}
