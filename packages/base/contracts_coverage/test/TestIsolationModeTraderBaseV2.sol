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

import { IsolationModeTraderBaseV2 } from "../isolation-mode/abstract/IsolationModeTraderBaseV2.sol";


/**
 * @title   TestIsolationModeTraderBaseV2
 * @author  Dolomite
 *
 * @notice  Test contract for IsolationModeTraderBaseV2
 */
contract TestIsolationModeTraderBaseV2 is IsolationModeTraderBaseV2 {

    // ======================== Constants ========================

    bytes32 private constant _FILE = "TestIsolationModeTraderBaseV2";

    // ======================== Constructor ========================

    constructor(
        address _vaultFactory,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeTraderBaseV2(
        _vaultFactory,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {}

    // ========================= Internal Functions ========================

    function testIsValidLiquidator(uint256 _marketId) external view returns (bool) {
        return _isValidLiquidator(msg.sender, _marketId);
    }

    function testOnlyGenericTraderOrTrustedLiquidator() external onlyGenericTraderOrTrustedLiquidator(msg.sender) {}
}
