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
 * @title   TestDoAnything
 * @author  Dolomite
 *
 * @notice  A test contract that can call any contract
 */
contract TestDoAnything {

    function callAnything(address _target, bytes memory _data) external {
        (bool success, bytes memory returnData) = _target.call(_data); // solhint-disable-line avoid-low-level-calls
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                returnData := add(returnData, 0x04)
            }
            (string memory errorMessage) = abi.decode(returnData, (string));
            revert(errorMessage);
        }
    }
}
