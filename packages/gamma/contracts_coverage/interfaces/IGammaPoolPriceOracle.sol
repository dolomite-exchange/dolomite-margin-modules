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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length


/**
 * @title   IGammaPoolPriceOracle
 * @author  Dolomite
 *
 * @notice  A price oracle contract for gamma pools
 */
interface IGammaPoolPriceOracle is IDolomitePriceOracle {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event GammaPoolSet(address _pool, bool _status);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetGammaPool(address _pool, bool _status) external;

    // ========================================================
    // =================== Getter Functions ===================
    // ========================================================

    function gammaPools(address _pool) external view returns (bool);
}
