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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { VeExternalVesterImplementationV1 } from "../VeExternalVesterImplementationV1.sol";


/**
 * @title   TestVeExternalVesterImplementationV1
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestVeExternalVesterImplementationV1 is VeExternalVesterImplementationV1 {

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        IERC20 _pairToken,
        uint256 _pairMarketId,
        IERC20 _paymentToken,
        uint256 _paymentMarketId,
        IERC20 _rewardToken,
        uint256 _rewardMarketId,
        address _veToken
    ) VeExternalVesterImplementationV1(
        _dolomiteMargin,
        _dolomiteRegistry,
        _pairToken,
        _pairMarketId,
        _paymentToken,
        _paymentMarketId,
        _rewardToken,
        _rewardMarketId,
        _veToken
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

    function callClosePositionAndBuyTokensAndTriggerReentrancy(
        uint256 _nftId,
        uint256 _veTokenId,
        uint256 _lockDuration,
        uint256 _maxPaymentAmount
    ) external payable nonReentrant {
        SafeDelegateCallLib.safeDelegateCall(
            address(this),
            abi.encodeWithSelector(
                this.closePositionAndBuyTokens.selector,
                _nftId,
                _veTokenId,
                _lockDuration,
                _maxPaymentAmount
            )
        );
    }
}
