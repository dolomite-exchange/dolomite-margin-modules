// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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


import { IBaseRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IBaseRegistry.sol";
import { IHandlerRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IHandlerRegistry.sol";
import { IGmxDataStore } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxDataStore.sol";
import { IGmxExchangeRouter } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxExchangeRouter.sol";
import { IGmxReader } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxReader.sol";
import { IGlvHandler } from "./IGlvHandler.sol";
import { IGlvReader } from "./IGlvReader.sol";
import { IGlvRouter } from "./IGlvRouter.sol";


/**
 * @title   IGlvRegistry
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the different addresses that can interact with the GLV ecosystem
 */
interface IGlvRegistry is IBaseRegistry, IHandlerRegistry {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event GmxExchangeRouterSet(address _gmxExchangeRouter);
    event GmxDataStoreSet(address _gmxDataStore);
    event GmxReaderSet(address _gmxReader);
    event GlvHandlerSet(address _glvHandler);
    event GlvReaderSet(address _glvReader);
    event GlvRouterSet(address _glvRouter);
    event GlvVaultSet(address _glvVault);
    event GlvTokenToGmMarketSet(address _glvToken, address _gmMarket);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetGmxExchangeRouter(address _gmxExchangeRouter) external;

    function ownerSetGmxDataStore(address _gmxDataStore) external;

    function ownerSetGmxReader(address _gmxReader) external;

    function ownerSetGlvHandler(address _glvHandler) external;

    function ownerSetGlvReader(address _glvReader) external;

    function ownerSetGlvRouter(address _glvRouter) external;

    function ownerSetGlvVault(address _glvVault) external;

    function ownerSetGlvTokenToGmMarket(address _glvToken, address _gmMarket) external;

    function gmxExchangeRouter() external view returns (IGmxExchangeRouter);

    function gmxDataStore() external view returns (IGmxDataStore);

    function gmxReader() external view returns (IGmxReader);

    function glvReader() external view returns (IGlvReader);

    function glvRouter() external view returns (IGlvRouter);

    function glvHandler() external view returns (IGlvHandler);

    function glvVault() external view returns (address);

    function glvTokenToGmMarket(address _glvToken) external view returns (address);
}
