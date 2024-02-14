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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   ERC20Lib
 * @author  Dolomite
 *
 * @notice  Library contract that adds additional functionality to ERC20 tokens.
 */
library ERC20Lib {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "ERC20Lib";

    // ============ Functions ============

    function resetAllowanceIfNeededAndApprove(
        IERC20 _token,
        address _spender,
        uint256 _value
    ) internal {
        if (_token.allowance(address(this), _spender) > 0) {
            // If the allowance is already set, set it to 0 first
            _token.safeApprove(_spender, 0);
        }
        _token.safeApprove(_spender, _value);
    }
}
