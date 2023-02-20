// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginCallee } from "../../protocol/interfaces/IDolomiteMarginCallee.sol";
import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";


interface IWrappedTokenUserVaultUnwrapper is IDolomiteMarginExchangeWrapper, IDolomiteMarginCallee {

    /**
     * @return The liquidity token that this contract can unwrap
     */
    function token() external view returns (address);

    function outputMarketId() external view returns (uint256);

    /**
     * @notice  Creates the necessary actions for selling the `_heldMarket` into `_outputMarket`. Note, `_outputMarket`
     *          may not equal `_owedMarket` depending on the implementation of this contract. It is the responsibility
     *          of the caller to ensure that the `_outputMarket` is converted to `_owedMarket` in subsequent actions.
     *
     * @param _solidAccountId       The index of the account (according the Accounts[] array) that is performing the
     *                              liquidation.
     * @param _liquidAccountId      The index of the account (according the Accounts[] array) that is being liquidated.
     * @param _solidAccountOwner    The address of the owner of the account that is performing the liquidation.
     * @param _liquidAccountOwner   The address of the owner of the account that is being liquidated.
     * @param _owedMarket           The market that the liquid account owes and must be repaid via the liquidation.
     * @param _heldMarket           The market that the liquid account holds and must be sold to repay the
     *                              `_owedMarket`.
     * @param _owedAmount           The amount of the `_owedMarket` that the liquid account owes and must repay.
     * @param _heldAmount           The amount of the `_heldMarket` that the liquid account holds and must sell.
     * @return                      The actions that will be executed to unwrap the `_heldMarket` into `outputMarketId`.
     */
    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address _solidAccountOwner,
        address _liquidAccountOwner,
        uint256 _owedMarket,
        uint256 _heldMarket,
        uint256 _owedAmount,
        uint256 _heldAmount
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
