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
 * @title   IIsolationModeUnwrapperTrader
 * @author  Dolomite
 *
 * Interface for a contract that can convert an isolation mode token into an underlying component token.
 */
interface IIsolationModeUnwrapperTrader is IDolomiteMarginExchangeWrapper {

    /**
     * @return The isolation mode token that this contract can unwrap (the input token).
     */
    function token() external view returns (address);

    /**
     * @return True if the `_outputToken` is a valid output token for this contract, to be unwrapped by `token()`.
     */
    function isValidOutputToken(address _outputToken) external view returns (bool);

    /**
     * @notice  Creates the necessary actions for selling the `_inputMarket` into `_outputMarket`. Note, the
     *          `_inputMarket` should be equal to `token()` and `_outputMarket` should be validated to be a correct
     *           market that can be transformed into `token()`.
     *
     * @param  _primaryAccountId    The index of the account (according the Accounts[] array) that is performing the
     *                              sell.
     * @param  _otherAccountId      The index of the account (according the Accounts[] array) that is being liquidated.
     *                              This is set to `_primaryAccountId` if a liquidation is not occurring.
     * @param  _primaryAccountOwner The address of the owner of the account that is performing the sell.
     * @param  _otherAccountOwner   The address of the owner of the account that is being liquidated. This is set to
     *                              `_primaryAccountOwner` if a liquidation is not occurring.
     * @param  _outputMarket        The market that is being outputted by the unwrapping.
     * @param  _inputMarket         The market that is being unwrapped, should be equal to `token()`.
     * @param  _minOutputAmount     The min amount of `_outputMarket` that must be outputted by the unwrapping.
     * @param  _inputAmount         The amount of the `_inputMarket` that the _primaryAccountId must sell.
     * @param  _orderData           The calldata to pass through to any external sales that occur.
     * @return                      The actions that will be executed to unwrap the `_inputMarket` into `_outputMarket`.
     */
    function createActionsForUnwrapping(
        uint256 _primaryAccountId,
        uint256 _otherAccountId,
        address _primaryAccountOwner,
        address _otherAccountOwner,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minOutputAmount,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
        external
        view
        returns (IDolomiteMargin.ActionArgs[] memory);

    /**
     * @return  The number of actions used to unwrap the isolation mode token.
     */
    function actionsLength() external view returns (uint256);
}
