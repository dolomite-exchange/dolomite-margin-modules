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

import { IDolomiteERC20 } from "./IDolomiteERC20.sol";


/**
 * @title   IDolomiteERC20WithPayable
 * @author  Dolomite
 *
 * @notice  Interface for enabling minting / redeeming with ETH (the native currency of any EVM)
 */
interface IDolomiteERC20WithPayable is IDolomiteERC20 {

    // ========================================================
    // ================ User Write Functions ==================
    // ========================================================

    /**
     * @return _dAmount The amount of dTOKEN minted to `msg.sender`
     */
    function mintFromPayable() external payable returns (uint256 _dAmount);

    /**
     * @notice  This function does not require a token approval from `msg.sender` to process the redemption.
     *
     * @param  _dAmount The amount of dTOKEN (IE dWETH) that should be redeemed for TOKEN (IE WETH).
     * @return _amount  The amount of TOKEN returned to `msg.sender` (IE ETH).
     */
    function redeemToPayable(uint256 _dAmount) external returns (uint256 _amount);
}
