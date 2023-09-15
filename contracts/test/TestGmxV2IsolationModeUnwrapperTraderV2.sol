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

import { GmxV2IsolationModeUnwrapperTraderV2 } from "../external/gmxV2/GmxV2IsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IGenericTraderProxyV1 } from "../external/interfaces/IGenericTraderProxyV1.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";


/**
 * @title   TestGmxV2IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxV2IsolationModeUnwrapperTraderV2 is GmxV2IsolationModeUnwrapperTraderV2 {

    bytes32 private constant _FILE = "TestGmxV2IsolationModeUnwrapper";

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address,
        uint256 _minOutputAmount,
        address,
        uint256,
        bytes memory
    ) 
        internal
        override
        returns (uint256)
    {
        return _minOutputAmount - 1;
    }
}
