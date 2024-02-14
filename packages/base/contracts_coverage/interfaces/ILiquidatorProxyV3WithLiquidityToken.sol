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

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   ILiquidatorProxyV3WithLiquidityToken
 * @author  Dolomite
 *
 * @notice  Interface for the V3 liquidator
 */
interface ILiquidatorProxyV3WithLiquidityToken {

    function setMarketIdToTokenUnwrapperForLiquidationMap(
        uint256 _marketId,
        address _tokenUnwrapper
    ) external;

    /**
     * Liquidate liquidAccount using solidAccount. This contract and the msg.sender to this contract must both be
     * operators for the solidAccount.
     *
     * @param  _solidAccount                The account that will do the liquidating
     * @param  _liquidAccount               The account that will be liquidated
     * @param  _owedMarket                  The owed market whose borrowed value will be added to `owedWeiToLiquidate`
     * @param  _heldMarket                  The held market whose collateral will be recovered to take on the debt of
     *                                      `owedMarket`
     * @param  _expiry                      The time at which the position expires, if this liquidation is for closing
     *                                      an expired position. Else, 0.
     * @param  _paraswapCallData            The calldata to be passed along to Paraswap's router for liquidation
     */
    function liquidate(
        IDolomiteStructs.AccountInfo calldata _solidAccount,
        IDolomiteStructs.AccountInfo calldata _liquidAccount,
        uint256 _owedMarket,
        uint256 _heldMarket,
        uint256 _expiry,
        bytes calldata _paraswapCallData
    ) external;
}
