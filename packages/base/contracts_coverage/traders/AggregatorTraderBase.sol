// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2022 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";


/**
 * @title   AggregatorTraderBase
 * @author  Dolomite
 *
 * Contract for performing an external trade with Odos using typesafe decoding of the function calls.
 */
abstract contract AggregatorTraderBase is OnlyDolomiteMargin, IDolomiteMarginExchangeWrapper {

    // ============ Constants ============

    bytes32 private constant _FILE = "AggregatorTraderBase";
    uint256 private constant _SCALE_AMOUNT = 1e36;

    // ============ Constructor ============

    constructor(
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(_dolomiteMargin)
    {}

    // ============ Public Functions ============


    function _getScaledExpectedOutputAmount(
        uint256 _originalInputAmount,
        uint256 _actualInputAmount,
        uint256 _expectedOutputAmount
    ) internal pure returns (uint256) {
        if (_originalInputAmount >= _actualInputAmount) {
            return _expectedOutputAmount;
        } else {
            // The amount inputted to the API was less than what we're actually trading. Scale up the expected amount
            // out, so the user doesn't pay unnecessary positive slippage
            uint256 percentageUp = _actualInputAmount * _SCALE_AMOUNT / _originalInputAmount;
            return _expectedOutputAmount * percentageUp / _SCALE_AMOUNT;
        }
    }
}
