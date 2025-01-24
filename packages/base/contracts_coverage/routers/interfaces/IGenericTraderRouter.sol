// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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

import { IRouterBase } from "./IRouterBase.sol";
import { IGenericTraderProxyV2 } from "../../proxies/interfaces/IGenericTraderProxyV2.sol";


/**
 * @title   IGenericTraderRouter
 * @author  Dolomite
 *
 * @notice  Interface for generic trader router
 */
interface IGenericTraderRouter is IRouterBase {

    enum TransferType {
        IntoPosition,
        OutOfPosition
    }

    struct SmartAssetSwapParams {
        address user;
        uint256 accountNumber;
        uint256 amount;
    }

    function swapExactInputForOutput(
        uint256 _isolationModeMarketId,
        IGenericTraderProxyV2.SwapExactInputForOutputParams memory _params
    ) external payable;

    function swapExactInputForOutputAndModifyPosition(
        uint256 _isolationModeMarketId,
        IGenericTraderProxyV2.SwapExactInputForOutputAndModifyPositionParams memory _params
    ) external payable;
}
