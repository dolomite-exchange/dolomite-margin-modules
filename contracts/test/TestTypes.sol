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
 * @title TestTypes
 * @author dYdX and Dolomite
 *
 * Contract for testing pure library functions
 */
contract TestTypes {

    // ============ Constants ============

    bytes32 constant FILE = "TestTypes";

    // ============ Types Functions ============

    function TypesZeroPar()
    external
    pure
    returns (IDolomiteMargin.Par memory)
    {
        return TypesLib.zeroPar();
    }

    function TypesParSub(
        IDolomiteMargin.Par memory a,
        IDolomiteMargin.Par memory b
    )
    public
    pure
    returns (IDolomiteMargin.Par memory)
    {
        return TypesLib.sub(a, b);
    }

    function TypesParAdd(
        IDolomiteMargin.Par memory a,
        IDolomiteMargin.Par memory b
    )
    public
    pure
    returns (IDolomiteMargin.Par memory)
    {
        return TypesLib.add(a, b);
    }

    function TypesParEquals(
        IDolomiteMargin.Par memory a,
        IDolomiteMargin.Par memory b
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.equals(a, b);
    }

    function TypesParNegative(
        IDolomiteMargin.Par memory a
    )
    public
    pure
    returns (IDolomiteMargin.Par memory)
    {
        return TypesLib.negative(a);
    }

    function TypesParIsNegative(
        IDolomiteMargin.Par memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isNegative(a);
    }

    function TypesParIsPositive(
        IDolomiteMargin.Par memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isPositive(a);
    }

    function TypesParIsZero(
        IDolomiteMargin.Par memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isZero(a);
    }

    function TypesParIsLessThanZero(
        IDolomiteMargin.Par memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isLessThanZero(a);
    }

    function TypesParIsGreaterThanOrEqualToZero(
        IDolomiteMargin.Par memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isGreaterThanOrEqualToZero(a);
    }

    function TypesZeroWei()
    external
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        return TypesLib.zeroWei();
    }

    function TypesWeiSub(
        IDolomiteMargin.Wei memory a,
        IDolomiteMargin.Wei memory b
    )
    public
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        return TypesLib.sub(a, b);
    }

    function TypesWeiAdd(
        IDolomiteMargin.Wei memory a,
        IDolomiteMargin.Wei memory b
    )
    public
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        return TypesLib.add(a, b);
    }

    function TypesWeiEquals(
        IDolomiteMargin.Wei memory a,
        IDolomiteMargin.Wei memory b
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.equals(a, b);
    }

    function TypesWeiNegative(
        IDolomiteMargin.Wei memory a
    )
    public
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        return TypesLib.negative(a);
    }

    function TypesWeiIsNegative(
        IDolomiteMargin.Wei memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isNegative(a);
    }

    function TypesWeiIsPositive(
        IDolomiteMargin.Wei memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isPositive(a);
    }

    function TypesWeiIsZero(
        IDolomiteMargin.Wei memory a
    )
    public
    pure
    returns (bool)
    {
        return TypesLib.isZero(a);
    }
}
