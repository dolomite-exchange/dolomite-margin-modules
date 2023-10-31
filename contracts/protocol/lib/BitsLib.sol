// SPDX-License-Identifier: Apache-2.0
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


/**
 * @title   BitsLib
 * @author  Dolomite
 *
 * Library for caching information about markets
 */
library BitsLib {

    // ============ Constants ============

    uint256 private constant _ONE = 1;
    uint256 private constant _MAX_UINT_BITS = 256;

    // ============ Functions ============

    function createBitmaps(uint256 _maxLength) internal pure returns (uint256[] memory) {
        return new uint256[]((_maxLength / _MAX_UINT_BITS) + _ONE);
    }

    function getMarketIdFromBit(
        uint256 _indexIntoBitmapsArray,
        uint256 _bit
    ) internal pure returns (uint256) {
        return (_MAX_UINT_BITS * _indexIntoBitmapsArray) + _bit;
    }

    function setBit(
        uint256[] memory _bitmaps,
        uint256 _marketId
    ) internal pure returns (uint256[] memory) {
        uint256 bucketIndex = _marketId / _MAX_UINT_BITS;
        uint256 indexFromRight = _marketId % _MAX_UINT_BITS;
        _bitmaps[bucketIndex] |= (_ONE << indexFromRight);
        return _bitmaps;
    }

    function hasBit(
        uint256[] memory _bitmaps,
        uint256 _marketId
    ) internal pure returns (bool) {
        uint256 bucketIndex = _marketId / _MAX_UINT_BITS;
        uint256 indexFromRight = _marketId % _MAX_UINT_BITS;
        uint256 bit = _bitmaps[bucketIndex] & (_ONE << indexFromRight);
        return bit > 0;
    }

    function unsetBit(
        uint256 _bitmap,
        uint256 _bit
    ) internal pure returns (uint256) {
        return _bitmap & ~(_ONE << _bit);
    }

    // solium-disable security/no-assign-params
    function getLeastSignificantBit(uint256 _value) internal pure returns (uint256) {
        if (_value == 0) {
            return 0;
        }

        uint256 leastSignificantBit = 255;

        if (_value & type(uint128).max > 0) {
            leastSignificantBit -= 128;
        } else {
            _value >>= 128;
        }

        if (_value & type(uint64).max > 0) {
            leastSignificantBit -= 64;
        } else {
            _value >>= 64;
        }

        if (_value & type(uint32).max > 0) {
            leastSignificantBit -= 32;
        } else {
            _value >>= 32;
        }

        if (_value & type(uint16).max > 0) {
            leastSignificantBit -= 16;
        } else {
            _value >>= 16;
        }

        if (_value & type(uint8).max > 0) {
            leastSignificantBit -= 8;
        } else {
            _value >>= 8;
        }

        if (_value & 0xf > 0) {
            leastSignificantBit -= 4;
        } else {
            _value >>= 4;
        }

        if (_value & 0x3 > 0) {
            leastSignificantBit -= 2;
        } else {
            _value >>= 2;
        }
        // solium-enable security/no-assign-params

        if (_value & 0x1 > 0) {
            leastSignificantBit -= 1;
        }

        return leastSignificantBit;
    }
}
