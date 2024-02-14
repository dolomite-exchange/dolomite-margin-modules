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

import { BitsLib } from "../protocol/lib/BitsLib.sol";


/**
 * @title   TestBitsLib
 * @author  Dolomite
 *
 * @notice  Contract for testing pure library functions
 */
contract TestBitsLib {

    // ============ Constants ============

    bytes32 internal constant _FILE = "TestBitsLib";

    // ============ BitsLib Functions ============

    function BitsLibCreateBitmaps(uint256 _maxLength)
    external
    pure
    returns (uint256[] memory)
    {
        return BitsLib.createBitmaps(_maxLength);
    }

    function BitsLibGetMarketIdFromBit(uint256 _index, uint256 _bit)
    external
    pure
    returns (uint256)
    {
        return BitsLib.getMarketIdFromBit(_index, _bit);
    }

    function BitsLibSetBit(uint256[] memory _bitmaps, uint256 _marketId)
    external
    pure
    returns (uint256[] memory)
    {
        return BitsLib.setBit(_bitmaps, _marketId);
    }

    function BitsLibHasBit(uint256[] memory _bitmaps, uint256 _marketId)
    external
    pure
    returns (bool)
    {
        return BitsLib.hasBit(_bitmaps, _marketId);
    }

    function BitsLibUnsetBit(uint256 _bitmap, uint256 _bit)
    external
    pure
    returns (uint256)
    {
        return BitsLib.unsetBit(_bitmap, _bit);
    }

    function BitsLibGetLeastSignificantBit(uint256 _value)
    external
    pure
    returns (uint256)
    {
        return BitsLib.getLeastSignificantBit(_value);
    }
}