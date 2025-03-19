// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { POLLiquidatorProxyV1 } from "../POLLiquidatorProxyV1.sol";
import { InternalSafeDelegateCallLib } from "@dolomite-exchange/modules-base/contracts/lib/InternalSafeDelegateCallLib.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestPOLLiquidatorProxyV1
 * @author  Dolomite
 *
 * @notice  Test POLLiquidatorProxyV1
 */
contract TestPOLLiquidatorProxyV1 is POLLiquidatorProxyV1 {
    using InternalSafeDelegateCallLib for address;
    // ============ Constants ============

    bytes32 private constant _FILE = "TestPOLLiquidatorProxyV1";

    // ==================================================================
    // ========================== Constructor ===========================
    // ==================================================================

    constructor(
        address _liquidatorProxyV5,
        address _dolomiteMargin
    )
        POLLiquidatorProxyV1(
            _liquidatorProxyV5,
            _dolomiteMargin
        ) {
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function callFunctionAndTriggerReentrancy(
        bytes calldata _callDataWithSelector
    ) external payable nonReentrant {
        address(this).safeDelegateCall(_callDataWithSelector);
    }
}
