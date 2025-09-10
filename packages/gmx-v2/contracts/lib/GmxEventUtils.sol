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


/**
 * @title   GmxEventUtils
 * @author  Dolomite
 *
 */
library GmxEventUtils {

    struct EmitPositionDecreaseParams {
        bytes32 key;
        address account;
        address market;
        address collateralToken;
        bool isLong;
    }

    struct EventLogData {
        AddressItems addressItems;
        UintItems uintItems;
        IntItems intItems;
        BoolItems boolItems;
        Bytes32Items bytes32Items;
        BytesItems bytesItems;
        StringItems stringItems;
    }

    struct AddressItems {
        AddressKeyValue[] items;
        AddressArrayKeyValue[] arrayItems;
    }

    struct UintItems {
        UintKeyValue[] items;
        UintArrayKeyValue[] arrayItems;
    }

    struct IntItems {
        IntKeyValue[] items;
        IntArrayKeyValue[] arrayItems;
    }

    struct BoolItems {
        BoolKeyValue[] items;
        BoolArrayKeyValue[] arrayItems;
    }

    struct Bytes32Items {
        Bytes32KeyValue[] items;
        Bytes32ArrayKeyValue[] arrayItems;
    }

    struct BytesItems {
        BytesKeyValue[] items;
        BytesArrayKeyValue[] arrayItems;
    }

    struct StringItems {
        StringKeyValue[] items;
        StringArrayKeyValue[] arrayItems;
    }

    struct AddressKeyValue {
        string key;
        address value;
    }

    struct AddressArrayKeyValue {
        string key;
        address[] value;
    }

    struct UintKeyValue {
        string key;
        uint256 value;
    }

    struct UintArrayKeyValue {
        string key;
        uint256[] value;
    }

    struct IntKeyValue {
        string key;
        int256 value;
    }

    struct IntArrayKeyValue {
        string key;
        int256[] value;
    }

    struct BoolKeyValue {
        string key;
        bool value;
    }

    struct BoolArrayKeyValue {
        string key;
        bool[] value;
    }

    struct Bytes32KeyValue {
        string key;
        bytes32 value;
    }

    struct Bytes32ArrayKeyValue {
        string key;
        bytes32[] value;
    }

    struct BytesKeyValue {
        string key;
        bytes value;
    }

    struct BytesArrayKeyValue {
        string key;
        bytes[] value;
    }

    struct StringKeyValue {
        string key;
        string value;
    }

    struct StringArrayKeyValue {
        string key;
        string[] value;
    }

    function get(AddressItems memory addresses, string memory key) internal pure returns (address) {
        (bool found, address value) = getWithoutRevert(addresses, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getWithoutRevert(AddressItems memory addresses, string memory key) private pure returns (bool, address) {
        for (uint i = 0; i < addresses.items.length; i++) {
            if (compareStrings(addresses.items[i].key, key)) {
                return (true, addresses.items[i].value);
            }
        }
        return (false, address(0));
    }

    function getArray(
        AddressItems memory addresses,
        string memory key
    ) internal pure returns (address[] memory) {
        (bool found, address[] memory value) = getArrayWithoutRevert(addresses, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getArrayWithoutRevert(
        AddressItems memory addresses,
        string memory key
    ) private pure returns (bool, address[] memory) {
        for (uint i = 0; i < addresses.arrayItems.length; i++) {
            if (compareStrings(addresses.arrayItems[i].key, key)) {
                return (true, addresses.arrayItems[i].value);
            }
        }
        address[] memory empty;
        return (false, empty);
    }

    function get(UintItems memory items, string memory key) internal pure returns (uint256) {
        (bool found, uint256 value) = getWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getWithoutRevert(UintItems memory items, string memory key) private pure returns (bool, uint256) {
        for (uint i = 0; i < items.items.length; i++) {
            if (compareStrings(items.items[i].key, key)) {
                return (true, items.items[i].value);
            }
        }
        return (false, 0);
    }

    function getArray(UintItems memory items, string memory key) internal pure returns (uint256[] memory) {
        (bool found, uint256[] memory value) = getArrayWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getArrayWithoutRevert(
        UintItems memory items,
        string memory key
    ) private pure returns (bool, uint256[] memory) {
        for (uint i = 0; i < items.arrayItems.length; i++) {
            if (compareStrings(items.arrayItems[i].key, key)) {
                return (true, items.arrayItems[i].value);
            }
        }
        uint256[] memory empty;
        return (false, empty);
    }

    function get(IntItems memory items, string memory key) internal pure returns (int256) {
        (bool found, int256 value) = getWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getWithoutRevert(IntItems memory items, string memory key) private pure returns (bool, int256) {
        for (uint i = 0; i < items.items.length; i++) {
            if (compareStrings(items.items[i].key, key)) {
                return (true, items.items[i].value);
            }
        }
        return (false, 0);
    }

    function getArray(IntItems memory items, string memory key) internal pure returns (int256[] memory) {
        (bool found, int256[] memory value) = getArrayWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getArrayWithoutRevert(
        IntItems memory items,
        string memory key
    ) private pure returns(bool, int256[] memory) {
        for (uint i = 0; i < items.arrayItems.length; i++) {
            if (compareStrings(items.arrayItems[i].key, key)) {
                return (true, items.arrayItems[i].value);
            }
        }
        int256[] memory empty;
        return (false, empty);
    }

    function get(BoolItems memory items, string memory key) internal pure returns (bool) {
        (bool found, bool value) = getWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getWithoutRevert(BoolItems memory items, string memory key) private pure returns (bool, bool) {
        for (uint i = 0; i < items.items.length; i++) {
            if (compareStrings(items.items[i].key, key)) {
                return (true, items.items[i].value);
            }
        }
        return (false, false);
    }

    function getArray(BoolItems memory items, string memory key) internal pure returns (bool[] memory) {
        (bool found, bool[] memory value) = getArrayWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getArrayWithoutRevert(BoolItems memory items, string memory key) private pure returns (bool, bool[] memory) {
        for (uint i = 0; i < items.arrayItems.length; i++) {
            if (compareStrings(items.arrayItems[i].key, key)) {
                return (true, items.arrayItems[i].value);
            }
        }
        bool[] memory empty;
        return (false, empty);
    }

    function get(Bytes32Items memory items, string memory key) internal pure returns (bytes32) {
        (bool found, bytes32 value) = getWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getWithoutRevert(Bytes32Items memory items, string memory key) private pure returns (bool, bytes32) {
        for (uint i = 0; i < items.items.length; i++) {
            if (compareStrings(items.items[i].key, key)) {
                return (true, items.items[i].value);
            }
        }
        return (false, 0);
    }

    function getArray(Bytes32Items memory items, string memory key) internal pure returns (bytes32[] memory) {
        (bool found, bytes32[] memory value) = getArrayWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getArrayWithoutRevert(
        Bytes32Items memory items,
        string memory key
    ) private pure returns (bool, bytes32[] memory) {
        for (uint i = 0; i < items.arrayItems.length; i++) {
            if (compareStrings(items.arrayItems[i].key, key)) {
                return (true, items.arrayItems[i].value);
            }
        }
        bytes32[] memory empty;
        return (false, empty);
    }

    function get(BytesItems memory items, string memory key) internal pure returns (bytes memory) {
        (bool found, bytes memory value) = getWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getWithoutRevert(BytesItems memory items, string memory key) private pure returns (bool, bytes memory) {
        for (uint i = 0; i < items.items.length; i++) {
            if (compareStrings(items.items[i].key, key)) {
                return (true, items.items[i].value);
            }
        }
        return (false, "");
    }

    function getArray(BytesItems memory items, string memory key) internal pure returns (bytes[] memory) {
        (bool found, bytes[] memory value) = getArrayWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getArrayWithoutRevert(
        BytesItems memory items,
        string memory key
    ) private pure returns (bool, bytes[] memory) {
        for (uint i = 0; i < items.arrayItems.length; i++) {
            if (compareStrings(items.arrayItems[i].key, key)) {
                return (true, items.arrayItems[i].value);
            }
        }
        bytes[] memory empty;
        return (false, empty);
    }

    function get(StringItems memory items, string memory key) internal pure returns (string memory) {
        (bool found, string memory value) = getWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getWithoutRevert(StringItems memory items, string memory key) private pure returns (bool, string memory) {
        for (uint i = 0; i < items.items.length; i++) {
            if (compareStrings(items.items[i].key, key)) {
                return (true, items.items[i].value);
            }
        }
        return (false, "");
    }

    function getArray(StringItems memory items, string memory key) internal pure returns (string[] memory) {
        (bool found, string[] memory value) = getArrayWithoutRevert(items, key);
        if (!found) {
            revert("GmxEventUtils: EventItemNotFound");
        }
        return value;
    }

    function getArrayWithoutRevert(
        StringItems memory items,
        string memory key
    ) private pure returns(bool, string[] memory) {
        for (uint i = 0; i < items.arrayItems.length; i++) {
            if (compareStrings(items.arrayItems[i].key, key)) {
                return (true, items.arrayItems[i].value);
            }
        }
        string[] memory empty;
        return (false, empty);
    }

    function compareStrings(string memory a, string memory b) private pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}