// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite

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
import { IDolomiteAutoTrader } from "../../protocol/interfaces/IDolomiteAutoTrader.sol";


/**
 * @title   IInternalTradeLiquidatorProxy
 * @author  Dolomite
 *
 * @notice  Interface for the internal trade liquidator proxy
 */
interface IInternalTradeLiquidatorProxy is IDolomiteAutoTrader {
    event Liquidation(
        address solidAccountOwner,
        uint256 solidAccountNumber,
        address liquidAccountOwner,
        uint256 liquidAccountNumber,
        uint256 heldMarket,
        uint256 owedMarket,
        uint256 heldReward,
        uint256 debtRepaid
    );
    event HandlerSet(address handler);

    function liquidate(
        IDolomiteStructs.AccountInfo calldata _solidAccount,
        IDolomiteStructs.AccountInfo calldata _liquidAccount,
        uint256 _collateralMarketId,
        uint256 _debtMarketId,
        uint256 _inputAmount,
        uint256 _minOutputAmount
    ) external;

    function ownerSetHandler(address _handler) external;
}
