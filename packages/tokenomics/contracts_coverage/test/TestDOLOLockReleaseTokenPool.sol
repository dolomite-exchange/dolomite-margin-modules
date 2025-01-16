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

import { LockReleaseTokenPool } from "@chainlink/contracts-ccip/src/v0.8/ccip/pools/LockReleaseTokenPool.sol";
import { IERC20 } from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol"; // @solhint-disable-line max-line-length


/**
 * @title   TestDOLOLockReleaseTokenPool
 * @author  Dolomite
 *
 * LockReleaseTokenPool for DOLO CCIP
 */
contract TestDOLOLockReleaseTokenPool is LockReleaseTokenPool {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "TestDOLOLockReleaseTokenPool";

    constructor(
        IERC20 token,
        uint8 localTokenDecimals,
        address[] memory allowlist,
        address rmnProxy,
        bool acceptLiquidity,
        address router
    ) LockReleaseTokenPool(token, localTokenDecimals, allowlist, rmnProxy, acceptLiquidity, router) {
    }
}
