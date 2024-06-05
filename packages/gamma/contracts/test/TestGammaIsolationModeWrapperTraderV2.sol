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

import { GammaIsolationModeWrapperTraderV2 } from "../GammaIsolationModeWrapperTraderV2.sol";


/**
 * @title   TestGammaIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping gamma lp pool (via swapping and then minting)
 */
contract TestGammaIsolationModeWrapperTraderV2 is GammaIsolationModeWrapperTraderV2 {

    // ============ Constants ============

    bytes32 private constant _FILE = "TestGammaWrapperTraderV2";

    // ============ Constructor ============

    constructor(
        address _gammaRegistry,
        address _dGammaPool,
        address _dolomiteMargin
    ) GammaIsolationModeWrapperTraderV2(
        _gammaRegistry,
        _dGammaPool,
        _dolomiteMargin
    ) {}

    function testDoDeltaSwap(uint256 _token0PreBal, uint256 _token1PreBal) external returns (uint256, uint256) {
        return _doDeltaSwap(DELTA_SWAP_PAIR.token0(), DELTA_SWAP_PAIR.token1(), _token0PreBal, _token1PreBal);
    }

    function testRetrieveDust() external {
        _retrieveDust(DELTA_SWAP_PAIR.token0(), DELTA_SWAP_PAIR.token1());
    }
}
