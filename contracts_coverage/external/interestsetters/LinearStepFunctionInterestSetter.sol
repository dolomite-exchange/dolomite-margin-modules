// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite.

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

import { Require } from "../../protocol/lib/Require.sol";
import { ILinearStepFunctionInterestSetter } from "../interfaces/ILinearStepFunctionInterestSetter.sol";


/**
 * @title   LinearStepFunctionInterestSetter
 * @author  Dolomite
 *
 * @notice  Applies a linear utilization model to reach the optimal utilization until interest rates reach 90%
 *          utilization. Then interest rates scale linearly to 100% APR.
 */
contract LinearStepFunctionInterestSetter is ILinearStepFunctionInterestSetter {

    // =============== Constants ===============

    bytes32 private constant _FILE = "LinearStepFunctionInterestSetter";
    uint256 public constant ONE_HUNDRED_PERCENT = 1e18;
    uint256 public constant NINETY_PERCENT = 9e17;
    uint256 public constant TEN_PERCENT = 1e17;
    uint256 public constant SECONDS_IN_A_YEAR = 60 * 60 * 24 * 365;

    // =============== Immutable Storage ===============

    uint256 public immutable override LOWER_OPTIMAL_PERCENT; // solhint-disable-line
    uint256 public immutable override UPPER_OPTIMAL_PERCENT; // solhint-disable-line
    uint256 public immutable override OPTIMAL_UTILIZATION; // solhint-disable-line

    constructor(
        uint256 _lowerOptimalPercent,
        uint256 _upperOptimalPercent
    ) {
        if (_lowerOptimalPercent < _upperOptimalPercent) { /* FOR COVERAGE TESTING */ }
        Require.that(
_lowerOptimalPercent < _upperOptimalPercent,
            _FILE,
            "Lower optimal percent too high"
        );
        LOWER_OPTIMAL_PERCENT = _lowerOptimalPercent;
        UPPER_OPTIMAL_PERCENT = _upperOptimalPercent;
        OPTIMAL_UTILIZATION = NINETY_PERCENT;
    }

    function getInterestRate(
        address /* token */,
        uint256 _borrowWei,
        uint256 _supplyWei
    )
    external
    override
    view
    returns (InterestRate memory)
    {
        if (_borrowWei == 0) {
            return InterestRate({
                value: 0
            });
        } else if (_supplyWei == 0) {
            return InterestRate({
                value: (LOWER_OPTIMAL_PERCENT + UPPER_OPTIMAL_PERCENT) / SECONDS_IN_A_YEAR
            });
        }

        uint256 utilization = _borrowWei * ONE_HUNDRED_PERCENT / _supplyWei;
        if (utilization >= ONE_HUNDRED_PERCENT) {
            return InterestRate({
                value: (LOWER_OPTIMAL_PERCENT + UPPER_OPTIMAL_PERCENT) / SECONDS_IN_A_YEAR
            });
        } else if (utilization > NINETY_PERCENT) {
            // interest is equal to lowerOptimalPercent + linear progress to upperOptimalPercent APR
            uint256 interestToAdd = UPPER_OPTIMAL_PERCENT * (utilization - NINETY_PERCENT) / TEN_PERCENT;
            return InterestRate({
                value: (interestToAdd + LOWER_OPTIMAL_PERCENT) / SECONDS_IN_A_YEAR
            });
        } else {
            return InterestRate({
                value: LOWER_OPTIMAL_PERCENT * utilization / NINETY_PERCENT / SECONDS_IN_A_YEAR
            });
        }
    }

    function interestSetterType() external override pure returns (InterestSetterType) {
        return InterestSetterType.Linear;
    }
}
