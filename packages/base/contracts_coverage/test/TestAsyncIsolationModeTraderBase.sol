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

import { IHandlerRegistry } from "../interfaces/IHandlerRegistry.sol";
import { AsyncIsolationModeTraderBase } from "../isolation-mode/abstract/AsyncIsolationModeTraderBase.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";


/**
 * @title   TestAsyncIsolationModeTraderBase
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestAsyncIsolationModeTraderBase is AsyncIsolationModeTraderBase {

    bytes32 private constant _FILE = "TestAsyncIsolationModeTraderBase";
    bytes32 private constant _HANDLER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handler")) - 1);

    constructor(address _weth) AsyncIsolationModeTraderBase(_weth) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function initialize(
        address _gmxV2Registry,
        address _dolomiteMargin
    ) external initializer {
        _setHandlerViaSlot(_gmxV2Registry);
        _setDolomiteMarginViaSlot(_dolomiteMargin);
    }

    function triggerInternalInitializer(
        address _registry
    ) external {
        // solhint-disable-previous-line no-empty-blocks
    }

    function testOnlyHandler() external onlyHandler(msg.sender) {} // solhint-disable-line no-empty-blocks

    function testValidateIsRetryable(bool _retryable) external pure {
        _validateIsRetryable(_retryable);
    }

    function testEventEmitter() external view returns (IEventEmitterRegistry) {
        return _eventEmitter();
    }

    function HANDLER_REGISTRY() public view override returns (IHandlerRegistry) {
        return IHandlerRegistry(_getAddress(_HANDLER_SLOT));
    }

    function _setHandlerViaSlot(address _handler) internal {
        _setAddress(_HANDLER_SLOT, _handler);
    }

    function testRevert() external pure {
        revert("TestAsyncIsolationModeTraderBase: revert");
    }
}
