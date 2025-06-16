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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length


/**
 * @title   IAdminPauseMarket
 * @author  Dolomite
 *
 * @notice  Interface for the AdminPauseMarket contract
 */
interface IAdminPauseMarket is IDolomitePriceOracle {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event SetMarketPaused(uint256 marketId, bool isPaused);
    event TrustedCallerSet(address trustedCaller, bool isTrusted);

    // ========================================================
    // ==================== Admin Functions ===================
    // ========================================================

    function ownerSetTrustedCaller(address _caller, bool _trusted) external;

    function pauseMarket(uint256 _marketId) external;

    function unpauseMarket(uint256 _marketId, address _priceOracle) external;

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    function tokenToPaused(address _token) external view returns (bool);

    function trustedCallers(address _caller) external view returns (bool);

    function DOLOMITE_REGISTRY() external view returns (IDolomiteRegistry);
}
