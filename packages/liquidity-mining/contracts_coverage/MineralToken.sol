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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { IERC20Mintable } from "./interfaces/IERC20Mintable.sol";


/**
 * @title   MineralToken
 * @author  Dolomite
 *
 * ERC20 contract for oARB tokens
 */
contract MineralToken is IERC20Mintable, ERC20Upgradeable, OnlyDolomiteMargin {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "MineralToken";

    // ==================================================================
    // ======================= Constructor =======================
    // ==================================================================

    constructor(
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {} // solhint-disable-line no-empty-blocks

    function initialize() external initializer {
        __ERC20_init("Mineral Token", "MIN");
    }

    // ================================================================
    // ======================= Public Functions =======================
    // ================================================================

    function mint(uint256 _amount) public onlyDolomiteMarginGlobalOperator(msg.sender) {
        _mint(msg.sender, _amount);
    }

    function burn(uint256 _amount) public onlyDolomiteMarginGlobalOperator(msg.sender) {
        _burn(msg.sender, _amount);
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _beforeTokenTransfer(
        address _from,
        address /* _to */,
        uint256 /* _amount */
    ) internal view override {
        // Caller must be a minter or global operator
        if (_from == address(0) || DOLOMITE_MARGIN().getIsGlobalOperator(_from)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _from == address(0) || DOLOMITE_MARGIN().getIsGlobalOperator(_from),
            _FILE,
            "Caller is not a global operator",
            _from
        );
    }
}
