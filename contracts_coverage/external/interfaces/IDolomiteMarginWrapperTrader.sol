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
 * @title   IDolomiteMarginWrapperTrader
 * @author  Dolomite
 *
 * @notice
 */
interface IDolomiteMarginWrapperTrader is IDolomiteMarginExchangeWrapper {

    /**
     * @notice  Creates the necessary actions for selling the `_inputMarket` into `_outputMarket`.
     *
     * @param  _solidAccountId      The index of the account (according the Accounts[] array) that is performing the
     *                              liquidation.
     * @param  _liquidAccountId     The index of the account (according the Accounts[] array) that is being liquidated.
     * @param  _solidAccountOwner   The address of the owner of the account that is performing the liquidation.
     * @param  _liquidAccountOwner  The address of the owner of the account that is being liquidated.
     * @param  _outputMarket        The market that the liquid account owes and must be repaid via the liquidation.
     * @param  _inputMarket         The market that the liquid account holds and must be sold to repay the
     *                              `_outputMarket`.
     * @param  _outputAmount        The amount of the `_outputMarket` that the liquid account owes and must repay.
     * @param  _inputAmount         The amount of the `_inputMarket` that the liquid account holds and must sell.
     * @return                      The actions that will be executed to wrap the `_inputMarket` into `outputMarket`.
     */
    function createActionsForWrapping(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address _solidAccountOwner,
        address _liquidAccountOwner,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _outputAmount,
        uint256 _inputAmount
    )
    external
    view
    returns (IDolomiteMargin.ActionArgs[] memory);

    /**
     * @return  The number of Actions used to wrap the LP token from a given `_inputMarket`.
     */
    function actionsLength() external view returns (uint256);
}
