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

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";


/**
 * @title   TestDecimalLib
 * @author  Dolomite
 *
 * @notice  Contract for testing pure library functions
 */
contract TestDecimalLib {

    // ============ Constants ============

    bytes32 internal constant _FILE = "TestDecimalLib";

    // ============ DecimalLib Functions ============

    function DecimalLibOne()
    external
    pure
    returns (IDolomiteStructs.Decimal memory)
    {
        return DecimalLib.one();
    }

    function DecimalLibOnePlus(
        IDolomiteStructs.Decimal memory _decimal
    )
    external
    pure
    returns (IDolomiteStructs.Decimal memory)
    {
        return DecimalLib.onePlus(_decimal);
    }

    function DecimalLibMul(
        uint256 _target,
        IDolomiteStructs.Decimal memory _decimal
    )
    external
    pure
    returns (uint256)
    {
        return DecimalLib.mul(_target, _decimal);
    }

    function DecimalLibDiv(
        uint256 _target,
        IDolomiteStructs.Decimal memory _decimal
    )
    external
    pure
    returns (uint256)
    {
        return DecimalLib.div(_target, _decimal);
    }
}
