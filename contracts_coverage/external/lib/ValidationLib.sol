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

import { Require } from "../../protocol/lib/Require.sol";


/**
 * @title   ValidationLib
 * @author  Dolomite
 *
 * @notice  Library contract that checks generic calls to be successful (useful when validation config changes)
 */
library ValidationLib {
    // ============ Constants ============

    bytes32 private constant _FILE = "ValidationLib";

    // ============ Functions ============

    /**
     *  Converts the scaled Par value to an actual Wei value
     */
    function callAndCheckSuccess(
        address _target,
        bytes4 _selector,
        bytes memory _data
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returnData) = _target.staticcall(abi.encodePacked(_selector, _data));
        Require.that(
            success && returnData.length > 0,
            _FILE,
            "Call to target failed",
            _target
        );
        return returnData;
    }
}
