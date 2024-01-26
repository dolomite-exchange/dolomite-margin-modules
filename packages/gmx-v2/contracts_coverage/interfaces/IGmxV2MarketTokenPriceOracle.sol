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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol";


/**
 * @title   IGmxV2MarketTokenPriceOracle
 * @author  Dolomite
 *
 * @notice  Interface for the GmxV2MarketTokenPriceOracle to report GM token prices
 */
interface IGmxV2MarketTokenPriceOracle is IDolomitePriceOracle {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event MarketTokenSet(address _token, bool _status);

    // ===================================================
    // ==================== Functions ====================
    // ===================================================

    function ownerSetMarketToken(address _token, bool _status) external;

}
