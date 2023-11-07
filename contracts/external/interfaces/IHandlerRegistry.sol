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

import { IBaseRegistry } from "./IBaseRegistry.sol";
import { IIsolationModeVaultFactory } from "./IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "./IUpgradeableAsyncIsolationModeUnwrapperTrader.sol";
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "./IUpgradeableAsyncIsolationModeWrapperTrader.sol";


/**
 * @title   IHandlerRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing whether or not a handler is trusted for executing a function
 */
interface IHandlerRegistry is IBaseRegistry {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event HandlerSet(address _handler, bool _isTrusted);
    event CallbackGasLimitSet(uint256 _callbackGasLimit);
    event UnwrapperTraderSet(address _token, address _unwrapperTrader);
    event WrapperTraderSet(address _token, address _wrapperTrader);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetIsHandler(
        address _handler,
        bool _isTrusted
    )
    external;

    function ownerSetCallbackGasLimit(
        uint256 _callbackGasLimit
    )
    external;

    function ownerSetUnwrapperByToken(
        IIsolationModeVaultFactory _factoryToken,
        IUpgradeableAsyncIsolationModeUnwrapperTrader _unwrapperTrader
    )
    external;

    function ownerSetWrapperByToken(
        IIsolationModeVaultFactory _factoryToken,
        IUpgradeableAsyncIsolationModeWrapperTrader _wrapperTrader
    )
    external;

    function isHandler(address _handler) external view returns (bool);

    function callbackGasLimit() external view returns (uint256);

    function getUnwrapperByToken(
        IIsolationModeVaultFactory _factoryToken
    ) external view returns (IUpgradeableAsyncIsolationModeUnwrapperTrader);

    function getWrapperByToken(
        IIsolationModeVaultFactory _factoryToken
    ) external view returns (IUpgradeableAsyncIsolationModeWrapperTrader);
}
