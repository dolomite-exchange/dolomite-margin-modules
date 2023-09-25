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

import { GmxV2IsolationModeTraderBase } from "../external/gmxV2/GmxV2IsolationModeTraderBase.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestGmxV2IsolationModeTraderBase
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxV2IsolationModeTraderBase is GmxV2IsolationModeTraderBase {

    bytes32 private constant _FILE = "TestGmxV2IsolationModeTraderBase";

    function initialize(
        address _gmxRegistryV2,
        address _weth,
        uint256 _callbackGasLimit,
        uint256 _slippageMinimum,
        address _dolomiteMargin
    ) external initializer {
        _initializeTraderBase(_gmxRegistryV2, _weth, _callbackGasLimit, _slippageMinimum);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
    }

    function triggerInternalInitializer(
        address _gmxRegistryV2,
        address _weth,
        uint256 _callbackGasLimit,
        uint256 _slippageMinimum
    ) external {
        _initializeTraderBase(_gmxRegistryV2, _weth, _callbackGasLimit, _slippageMinimum);
    }

    function testOnlyHandler() external onlyHandler(msg.sender) {} // solhint-disable-line no-empty-blocks
}
