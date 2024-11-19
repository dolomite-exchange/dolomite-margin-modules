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

import { IDolomiteERC4626 } from "./IDolomiteERC4626.sol";


/**
 * @title   IDolomiteERC4626WithPayable
 * @author  Dolomite
 *
 * @notice  Interface that defines an ERC4626 wrapper around a user's Dolomite balance.
 */
interface IDolomiteERC4626WithPayable is IDolomiteERC4626 {

    // ========================================================
    // ================ User Write Functions ==================
    // ========================================================

    /**
     *
     * @param  _receiver   The address of the user that will receive the `_dAmount`
     * @return _dAmount    The amount of dTOKEN minted to `msg.sender`
     */
    function depositFromPayable(address _receiver) external payable returns (uint256 _dAmount);

    /**
     * @notice  This function does not require a token approval from `msg.sender` to process the redemption unless
     *          `_owner` and `msg.sender` do not match.
     *
     * @param  _amount      The amount of TOKEN (IE ETH) that should be withdrawn
     * @param  _receiver    The address of the user that will receive the `_amount`
     * @param  _owner       The address that owns the `dToken` and will be redeeming it. Must have an allowance set if
     *                      `msg.sender != _owner`
     * @return _dAmount     The amount of dTOKEN returned to `msg.sender` as TOKEN (IE ETH).
     */
    function withdrawToPayable(uint256 _amount, address _receiver, address _owner) external returns (uint256 _dAmount);

    /**
     * @notice  This function does not require a token approval from `msg.sender` to process the redemption.
     *
     * @param  _dAmount     The amount of dTOKEN (IE dWETH) that should be redeemed for TOKEN (IE WETH).
     * @param  _receiver    The address of the user that will receive the `_amount`
     * @param  _owner       The address that owns the `dToken` and will be redeeming it. Must have an allowance set if
     *                      `msg.sender != _owner`
     * @return _amount      The amount of TOKEN returned to `msg.sender` (IE ETH).
     */
    function redeemToPayable(uint256 _dAmount, address _receiver, address _owner) external returns (uint256 _amount);
}
