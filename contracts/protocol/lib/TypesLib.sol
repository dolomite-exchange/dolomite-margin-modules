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

import { IDolomiteMargin } from "../interfaces/IDolomiteMargin.sol";

import { DolomiteMarginMath } from "./DolomiteMarginMath.sol";


/**
 * @title TypesLib
 * @author dYdX
 *
 * Library for interacting with the basic structs used in DolomiteMargin
 */
library TypesLib {
    using DolomiteMarginMath for uint256;

    // ============ Par (Principal Amount) ============

    function zeroPar()
    internal
    pure
    returns (IDolomiteMargin.Par memory)
    {
        return Par({
        sign: false,
        value: 0
        });
    }

    function sub(
        IDolomiteMargin.Par memory a,
        IDolomiteMargin.Par memory b
    )
    internal
    pure
    returns (IDolomiteMargin.Par memory)
    {
        return add(a, negative(b));
    }

    function add(
        IDolomiteMargin.Par memory a,
        IDolomiteMargin.Par memory b
    )
    internal
    pure
    returns (IDolomiteMargin.Par memory)
    {
        IDolomiteMargin.Par memory result;
        if (a.sign == b.sign) {
            result.sign = a.sign;
            result.value = SafeMath.add(a.value, b.value).to128();
        } else {
            if (a.value >= b.value) {
                result.sign = a.sign;
                result.value = SafeMath.sub(a.value, b.value).to128();
            } else {
                result.sign = b.sign;
                result.value = SafeMath.sub(b.value, a.value).to128();
            }
        }
        return result;
    }

    function equals(
        IDolomiteMargin.Par memory a,
        IDolomiteMargin.Par memory b
    )
    internal
    pure
    returns (bool)
    {
        if (a.value == b.value) {
            if (a.value == 0) {
                return true;
            }
            return a.sign == b.sign;
        }
        return false;
    }

    function negative(
        IDolomiteMargin.Par memory a
    )
    internal
    pure
    returns (IDolomiteMargin.Par memory)
    {
        return Par({
        sign: !a.sign,
        value: a.value
        });
    }

    function isNegative(
        IDolomiteMargin.Par memory a
    )
    internal
    pure
    returns (bool)
    {
        return !a.sign && a.value > 0;
    }

    function isPositive(
        IDolomiteMargin.Par memory a
    )
    internal
    pure
    returns (bool)
    {
        return a.sign && a.value > 0;
    }

    function isZero(
        IDolomiteMargin.Par memory a
    )
    internal
    pure
    returns (bool)
    {
        return a.value == 0;
    }

    function isLessThanZero(
        IDolomiteMargin.Par memory a
    )
    internal
    pure
    returns (bool)
    {
        return a.value > 0 && !a.sign;
    }

    function isGreaterThanOrEqualToZero(
        IDolomiteMargin.Par memory a
    )
    internal
    pure
    returns (bool)
    {
        return isZero(a) || a.sign;
    }

    // ============ Wei (Token Amount) ============

    function zeroWei()
    internal
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        return Wei({
        sign: false,
        value: 0
        });
    }

    function sub(
        IDolomiteMargin.Wei memory a,
        IDolomiteMargin.Wei memory b
    )
    internal
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        return add(a, negative(b));
    }

    function add(
        IDolomiteMargin.Wei memory a,
        IDolomiteMargin.Wei memory b
    )
    internal
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        IDolomiteMargin.Wei memory result;
        if (a.sign == b.sign) {
            result.sign = a.sign;
            result.value = SafeMath.add(a.value, b.value);
        } else {
            if (a.value >= b.value) {
                result.sign = a.sign;
                result.value = SafeMath.sub(a.value, b.value);
            } else {
                result.sign = b.sign;
                result.value = SafeMath.sub(b.value, a.value);
            }
        }
        return result;
    }

    function equals(
        IDolomiteMargin.Wei memory a,
        IDolomiteMargin.Wei memory b
    )
    internal
    pure
    returns (bool)
    {
        if (a.value == b.value) {
            if (a.value == 0) {
                return true;
            }
            return a.sign == b.sign;
        }
        return false;
    }

    function negative(
        IDolomiteMargin.Wei memory a
    )
    internal
    pure
    returns (IDolomiteMargin.Wei memory)
    {
        return Wei({
        sign: !a.sign,
        value: a.value
        });
    }

    function isNegative(
        IDolomiteMargin.Wei memory a
    )
    internal
    pure
    returns (bool)
    {
        return !a.sign && a.value > 0;
    }

    function isPositive(
        IDolomiteMargin.Wei memory a
    )
    internal
    pure
    returns (bool)
    {
        return a.sign && a.value > 0;
    }

    function isZero(
        IDolomiteMargin.Wei memory a
    )
    internal
    pure
    returns (bool)
    {
        return a.value == 0;
    }
}
