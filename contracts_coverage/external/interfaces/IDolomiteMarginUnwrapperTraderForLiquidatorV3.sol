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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";


/**
 * @title   IDolomiteMarginUnwrapperTraderForLiquidatorV3
 * @author  Dolomite
 *
 * @notice  A contract for unwrapping some (liquidity/isolation) token into a specific market. This contract is used
 *          when liquidating an account that holds a wrapped token (e.g. a liquidity token) or when a user wants to
 *          sell a wrapped token for a specific market.
 */
interface IDolomiteMarginUnwrapperTraderForLiquidatorV3 is IDolomiteMarginExchangeWrapper {

    /**
     * @return The liquidity token that this contract can unwrap
     */
    function token() external view returns (address);

    function outputMarketId() external view returns (uint256);

    /**
     * @notice  Creates the necessary actions for selling the `_inputMarket` into `_outputMarket`. Note, `_outputMarket`
     *          may not equal `_outputMarket` depending on the implementation of this contract. It is the responsibility
     *          of the caller to ensure that the `_outputMarket` is converted to `_outputMarket` in subsequent actions.
     *
     * @param  _solidAccountId      The index of the account (according the Accounts[] array) that is performing the
     *                              liquidation.
     * @param  _liquidAccountId     The index of the account (according the Accounts[] array) that is being liquidated.
     * @param  _solidAccountOwner   The address of the owner of the account that is performing the liquidation.
     * @param  _liquidAccountOwner  The address of the owner of the account that is being liquidated.
     * @param  _outputMarket        The market that the liquid account owes and must be repaid via the liquidation.
     * @param  _inputMarket         The market that the liquid account holds and must be sold to repay the
     *                              `_outputMarket`.
     * @param  _minOutputAmount     The min amount of the `_outputMarket` that the liquid account expects to pay.
     * @param  _inputAmount         The amount of the `_inputMarket` that the liquid account holds and must sell.
     * @return                      The actions that will be executed to unwrap the `_inputMarket` into `_outputMarket`.
     */
    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address _solidAccountOwner,
        address _liquidAccountOwner,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minOutputAmount,
        uint256 _inputAmount
    )
    external
    view
    returns (IDolomiteMargin.ActionArgs[] memory);

    /**
     * @return  The number of Actions used to unwrap the LP token into `outputMarketId`. If `owedMarketId` equals
     *          `outputMarketId`, there is no need to chain additional actions on, since the debt will be paid off.
     */
    function actionsLength() external view returns (uint256);
}
