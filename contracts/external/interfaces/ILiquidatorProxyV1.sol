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

import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   ILiquidatorProxyV1
 * @author  Dolomite
 *
 * @notice  Interface for the V1 liquidator
 */
interface ILiquidatorProxyV1 {

    /**
     * Liquidate liquidAccount using solidAccount. This contract and the msg.sender to this contract
     * must both be operators for the solidAccount.
     *
     * @param _solidAccount         The account that will do the liquidating
     * @param _liquidAccount        The account that will be liquidated
     * @param _minLiquidatorRatio   The minimum collateralization ratio to leave the solidAccount at. Setting this value
     *                              to `150000000000000000` is analogous to a 115% collateralization ratio.
     * @param _owedPreferences      Ordered list of markets to repay first
     * @param _heldPreferences      Ordered list of markets to receive payout for first
     */
    function liquidate(
        IDolomiteStructs.AccountInfo calldata _solidAccount,
        IDolomiteStructs.AccountInfo calldata _liquidAccount,
        IDolomiteStructs.Decimal calldata _minLiquidatorRatio,
        uint256 _minValueLiquidated,
        uint256[] calldata _owedPreferences,
        uint256[] calldata _heldPreferences
    ) external;
}
