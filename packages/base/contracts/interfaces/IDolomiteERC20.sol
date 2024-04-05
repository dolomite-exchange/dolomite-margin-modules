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

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";


/**
 * @title   IDolomiteERC20
 * @author  Dolomite
 *
 * @notice  A registry contract for storing all of the addresses that can interact with Umami's Delta Neutral vaults
 */
interface IDolomiteERC20 is IERC20Metadata {

    // ========================================================
    // ======================== Events ========================
    // ========================================================

    event LogSetReceiver(address indexed _receiver, bool _isEnabled);

    // ========================================================
    // =================== Admin Functions ====================
    // ========================================================

    function ownerSetIsReceiver(address _receiver, bool _isEnabled) external;

    // ========================================================
    // ==================== Other Functions ===================
    // ========================================================

    function enableIsReceiver() external;

    /**
     * @return  The total supply of this token including any accrued interest. Calling this function every second will
     *          see its value increase (assuming the interest rate is non-zero).
     */
    function unscaledTotalSupply() external view returns (uint256);

    /**
     *
     * @param  _account The account whose unscaled balance should be retrieved.
     * @return  The balance of `_account`, including any accrued interest. Calling this function every second will
     *          see its value increase (assuming the interest rate is non-zero).
     */
    function unscaledBalanceOf(address _account) external view returns (uint256);
}
