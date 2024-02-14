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


/**
 * @title   IOdosRouter
 * @author  Dolomite
 *
 * @notice  Interface for executing trades via Paraswap
 */
interface IOdosRouter {

    // ==================== Structs ====================

    struct SwapTokenInfo {
        address inputToken;
        uint256 inputAmount;
        address inputReceiver;
        address outputToken;
        uint256 outputQuote;
        uint256 outputMin;
        address outputReceiver;
    }

    /**
     * @notice Externally facing interface for swapping two tokens
     *
     * @param  tokenInfo        All information about the tokens being swapped
     * @param  pathDefinition   Encoded path definition for executor
     * @param  executor         Address of contract that will execute the path
     * @param  referralCode     Referral code to specify the source of the swap
     * @return amountOut        The amount returned from the swap
     */
    function swap(
        SwapTokenInfo calldata tokenInfo,
        bytes calldata pathDefinition,
        address executor,
        uint32 referralCode
    )
    external
    payable
    returns (uint256 amountOut);
}
