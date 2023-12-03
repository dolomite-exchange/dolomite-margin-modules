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

import { IOARB } from "./IOARB.sol";
import { IVesterV1 } from "./IVesterV1.sol";


/**
 * @title   IVesterV2
 * @author  Dolomite
 *
 * Interface for a vesting contract that offers users a discount on ARB tokens
 * if they vest ARB and oARB for a length of time
 */
interface IVesterV2 is IVesterV1 {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event VestingStarted(address indexed owner, uint256 duration, uint256 amount, uint256 vestingId);

    /**
     *
     * @return  The version this implementation contract used by the proxy. Starts at 0 and increments when there is an
     *          upgrade
     */
    function version() external view returns (uint256);
}
