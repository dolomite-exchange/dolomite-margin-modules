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

import { IAsyncFreezableIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IAsyncFreezableIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IGlvRegistry } from "./IGlvRegistry.sol";


/**
 * @title   IGlvIsolationModeVaultFactory
 * @author  Dolomite
 *
 * @notice  Interface for a subclass of IsolationModeVaultFactory that creates vaults for GLV tokens.
 */
interface IGlvIsolationModeVaultFactory is IAsyncFreezableIsolationModeVaultFactory {

    // ================================================
    // ==================== Structs ===================
    // ================================================

    struct MarketInfoConstructorParams {
        address glvToken;
        address shortToken;
        address longToken;
    }

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function SHORT_TOKEN() external view returns (address);

    function LONG_TOKEN() external view returns (address);

    function SHORT_TOKEN_MARKET_ID() external view returns (uint256);

    function LONG_TOKEN_MARKET_ID() external view returns (uint256);

    function glvRegistry() external view returns (IGlvRegistry);
}
