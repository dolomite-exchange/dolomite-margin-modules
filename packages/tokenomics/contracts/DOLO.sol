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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";


/**
 * @title   DOLO
 * @author  Dolomite
 *
 * ERC20 contract for DOLO token
 */
contract DOLO is ERC20Burnable, OnlyDolomiteMargin {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "DOLO";

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin
    ) ERC20("DOLO", "DOLO") OnlyDolomiteMargin(_dolomiteMargin) {} // solhint-disable-line no-empty-blocks

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function mint(uint256 _amount) external onlyDolomiteMarginOwner(msg.sender) {
        _mint(msg.sender, _amount);
    }
}
