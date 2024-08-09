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
 * @notice  Interface that defines a tokenized wrapper around a user's Dolomite balance.
 */
interface IDolomiteERC20 is IERC20Metadata {

    struct MetadataStruct {
        string name;
        string symbol;
        uint8 decimals;
    }

    // ========================================================
    // ================ User Write Functions ==================
    // ========================================================

    /**
     * @notice  This function does requires a token approval from `msg.sender` on DOLOMITE_MARGIN to succeed.
     *
     * @param  _amount  The amount of TOKEN (IE USDC) that should be pulled into this dToken contract, to emit dTOKEN
     * @return _dAmount The amount of dTOKEN minted to `msg.sender`
     */
    function mint(uint256 _amount) external returns (uint256 _dAmount);

    /**
     * @notice  This function does not require a token approval from `msg.sender` to process the redemption.
     *
     * @param  _dAmount The amount of dTOKEN (IE dUSDC) that should be redeemed for TOKEN (IE USDC).
     * @return _amount  The amount of TOKEN returned to `msg.sender`
     */
    function redeem(uint256 _dAmount) external returns (uint256 _amount);

    // ========================================================
    // ================== User Read Functions =================
    // ========================================================

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
