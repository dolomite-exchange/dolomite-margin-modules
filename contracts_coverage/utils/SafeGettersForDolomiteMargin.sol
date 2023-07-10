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

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";


/**
 * @title   SafeGettersForDolomiteMargin
 * @author  Dolomite
 *
 * @notice  Contract for getting data from DolomiteMargin without reverting
 */
contract SafeGettersForDolomiteMargin {

    // ============ Storage ============

    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(address _dolomiteMargin) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    /**
     *
     * @param  _token   The token to get the market ID for
     * @return          The market ID for the given token or type(uint256).max if the token is not a valid market
     */
    function getMarketIdByTokenAddress(address _token) external view returns (uint256) {
        try DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token) returns (uint256 marketId) {
            return marketId;
        } catch {
            return type(uint256).max;
        }
    }
}
