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

import { BurnMintTokenPool } from "@chainlink/contracts-ccip/src/v0.8/ccip/pools/BurnMintTokenPool.sol";
import { IBurnMintERC20 } from "@chainlink/contracts-ccip/src/v0.8/shared/token/ERC20/IBurnMintERC20.sol";


/**
 * @title   TestDOLOBurnMintTokenPool
 * @author  Dolomite
 *
 * BurnMintTokenPool for DOLO CCIP
 */
contract TestDOLOBurnMintTokenPool is BurnMintTokenPool {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "TestDOLOBurnMintTokenPool";

    constructor(
        IBurnMintERC20 token,
        uint8 localTokenDecimals,
        address[] memory allowlist,
        address rmnProxy,
        address router
    ) BurnMintTokenPool(token, localTokenDecimals, allowlist, rmnProxy, router) {
    }
}
