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

import { AsyncIsolationModeTraderBase } from "../external/proxies/abstract/AsyncIsolationModeTraderBase.sol";


/**
 * @title   TestAsyncIsolationModeTraderBase
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestAsyncIsolationModeTraderBase is AsyncIsolationModeTraderBase {

    bytes32 private constant _FILE = "TestAsyncIsolationModeTraderBase";

    constructor(address _weth) AsyncIsolationModeTraderBase(_weth) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function initialize(
        address _gmxV2Registry,
        address _dolomiteMargin
    ) external initializer {
        _initializeAsyncTraderBase(_gmxV2Registry);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
    }

    function triggerInternalInitializer(
        address _gmxV2Registry
    ) external {
        _initializeAsyncTraderBase(_gmxV2Registry);
    }

    function testOnlyHandler() external onlyHandler(msg.sender) {} // solhint-disable-line no-empty-blocks
}
