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
 * @title   ProxyContractHelpers
 * @author  Dolomite
 *
 * @notice  Helper functions for upgradeable proxy contracts to use
 */
abstract contract ProxyContractHelpers {

    // ================ Internal Functions ==================

    function _callImplementation(address _implementation) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), _implementation, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    function _setAddress(bytes32 slot, address _value) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, _value)
        }
    }

    function _setAddressInMap(bytes32 slot, address key, address _value) internal {
        // solhint-disable-next-line no-inline-assembly
        bytes32 mappingSlot = keccak256(abi.encode(key, slot));
        assembly {
            sstore(mappingSlot, _value)
        }
    }

    function _setAddressInNestedMap(bytes32 _slot, address _key1, uint256 _key2, address _value) internal {
        bytes32 mappingSlot = keccak256(abi.encode(_key2, keccak256(abi.encode(_key1, _slot))));
        assembly {
            sstore(mappingSlot, _value)
        }
    }

    function _setUint256(bytes32 slot, uint256 _value) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, _value)
        }
    }

    function _setUint256InMap(bytes32 slot, address key, uint256 _value) internal {
        // solhint-disable-next-line no-inline-assembly
        bytes32 mappingSlot = keccak256(abi.encode(key, slot));
        assembly {
            sstore(mappingSlot, _value)
        }
    }

    function _setUint256InNestedMap(bytes32 slot, address key1, address key2, uint256 _value) internal {
        bytes32 mappingSlot = keccak256(abi.encode(key2, keccak256(abi.encode(key1, slot))));
        assembly {
            sstore(mappingSlot, _value)
        }
    }

    function _getAddress(bytes32 slot) internal view returns (address value) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            value := sload(slot)
        }
    }

    function _getAddressFromMap(bytes32 slot, address key) internal view returns (address value) {
        // solhint-disable-next-line no-inline-assembly
        bytes32 mappingSlot = keccak256(abi.encode(key, slot));
        assembly {
            value := sload(mappingSlot)
        }
    }

    function _getAddressInNestedMap(bytes32 _slot, address _key1, uint256 _key2) internal view returns (address value) {
        bytes32 mappingSlot = keccak256(abi.encode(_key2, keccak256(abi.encode(_key1, _slot))));
        assembly {
            value := sload(mappingSlot)
        }
    }

    function _getUint256(bytes32 slot) internal view returns (uint256 value) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            value := sload(slot)
        }
    }

    function _getUint256FromMap(bytes32 slot, address key) internal view returns (uint256 value) {
        // solhint-disable-next-line no-inline-assembly
        bytes32 mappingSlot = keccak256(abi.encode(key, slot));
        assembly {
            value := sload(mappingSlot)
        }
    }

    function _getUint256InNestedMap(bytes32 slot, address key1, address key2) internal view returns (uint256 value) {
        bytes32 mappingSlot = keccak256(abi.encode(key2, keccak256(abi.encode(key1, slot))));
        assembly {
            value := sload(mappingSlot)
        }
    }
}
