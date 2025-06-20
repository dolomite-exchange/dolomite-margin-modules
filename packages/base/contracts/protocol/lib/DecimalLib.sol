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

import { DolomiteMarginMath } from "./DolomiteMarginMath.sol";
import { IDolomiteStructs } from "../interfaces/IDolomiteStructs.sol";


/**
 * @title   DecimalLib
 * @author  dYdX
 *
 * Library that defines a fixed-point number with 18 decimal places.
 */
library DecimalLib {

    // ============ Constants ============

    uint256 private constant _BASE = 10 ** 18;

    // ============ Functions ============

    function toDecimal(
        uint256 value
    )
        internal
        pure
        returns (IDolomiteStructs.Decimal memory)
    {
        return IDolomiteStructs.Decimal({ value: value });
    }

    function one()
        internal
        pure
        returns (IDolomiteStructs.Decimal memory)
    {
        return IDolomiteStructs.Decimal({ value: _BASE});
    }

    function onePlus(
        IDolomiteStructs.Decimal memory d
    )
        internal
        pure
        returns (IDolomiteStructs.Decimal memory)
    {
        return IDolomiteStructs.Decimal({ value: d.value + _BASE});
    }

    function oneSub(
        IDolomiteStructs.Decimal memory d
    )
        internal
        pure
        returns (IDolomiteStructs.Decimal memory)
    {
        return IDolomiteStructs.Decimal({ value: _BASE - d.value});
    }

    function mul(
        uint256 target,
        IDolomiteStructs.Decimal memory d
    )
        internal
        pure
        returns (uint256)
    {
        return DolomiteMarginMath.getPartial(target, d.value, _BASE);
    }

    function mul(
        IDolomiteStructs.Decimal memory d1,
        IDolomiteStructs.Decimal memory d2
    )
        internal
        pure
        returns (IDolomiteStructs.Decimal memory)
    {
        return IDolomiteStructs.Decimal({ value: mul(d1.value, d2) });
    }

    function div(
        uint256 target,
        IDolomiteStructs.Decimal memory d
    )
    internal
    pure
    returns (uint256)
    {
        return DolomiteMarginMath.getPartial(target, _BASE, d.value);
    }
}
