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
 * @title   SafeDelegateCallLib
 * @author  Dolomite
 *
 * @notice  Library contract for handling expiration logic
 */
library SafeDelegateCallLib {

    // ============ Constants ============

    bytes32 private constant _FILE = "SafeDelegateCallLib";

    // ============ Functions ============

    function safeDelegateCall(address _target, bytes memory _calldata) public returns (bytes memory) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool isSuccessful, bytes memory result) = _target.delegatecall(_calldata);
        if (!isSuccessful) {
            if (result.length < 68) {
                revert("No reversion message!");
            } else {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    result := add(result, 0x04) // Slice the sighash.
                }
            }
            (string memory errorMessage) = abi.decode(result, (string));
            revert(errorMessage);
        }

        return result;
    }
}
