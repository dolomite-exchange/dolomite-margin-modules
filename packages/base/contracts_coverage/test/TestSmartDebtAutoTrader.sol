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

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { SmartDebtAutoTrader } from "../traders/SmartDebtAutoTrader.sol";


/**
 * @title   TestSmartDebtAutoTrader
 * @author  Dolomite
 *
 * @notice  Test contract for SmartDebtAutoTrader
 */
contract TestSmartDebtAutoTrader is SmartDebtAutoTrader {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "TestSmartDebtAutoTrader";

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) SmartDebtAutoTrader(_chainId, _dolomiteRegistry, _dolomiteMargin) {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function testGetFeesByMarketIds(
        uint256 _marketId1,
        uint256 _marketId2
    ) external view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        return _getFees(_marketId1, _marketId2);
    }

    function testGetFeesByPairBytes(
        bytes32 _pairBytes
    ) external view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        return _getFees(_pairBytes);
    }
}
