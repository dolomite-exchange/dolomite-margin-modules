// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2019 dYdX Trading Inc.

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

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";

import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";


/**
 * @title TestDolomiteMarginMath
 * @author dYdX and Dolomite
 *
 * Contract for testing pure library functions
 */
contract TestDolomiteMarginMath {

    // ============ DolomiteMarginMath Functions ============

    function DolomiteMarginMathGetPartial(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
    external
    pure
    returns (uint256)
    {
        return DolomiteMarginMath.getPartial(target, numerator, denominator);
    }

    function DolomiteMarginMathGetPartialRoundHalfUp(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
    external
    pure
    returns (uint256)
    {
        return DolomiteMarginMath.getPartialRoundHalfUp(target, numerator, denominator);
    }

    function DolomiteMarginMathGetPartialRoundUp(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
    external
    pure
    returns (uint256)
    {
        return DolomiteMarginMath.getPartialRoundUp(target, numerator, denominator);
    }

    function DolomiteMarginMathTo128(
        uint256 x
    )
    external
    pure
    returns (uint128)
    {
        return DolomiteMarginMath.to128(x);
    }

    function DolomiteMarginMathTo96(
        uint256 x
    )
    external
    pure
    returns (uint96)
    {
        return DolomiteMarginMath.to96(x);
    }

    function DolomiteMarginMathTo32(
        uint256 x
    )
    external
    pure
    returns (uint32)
    {
        return DolomiteMarginMath.to32(x);
    }
}
