// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { InternalAutoTraderBase } from "../traders/InternalAutoTraderBase.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";


/**
 * @title   TestAutoTrader
 * @author  Dolomite
 *
 * @notice  A test implementation of IDolomiteAutoTrader
 */
contract TestDolomiteAutoTrader is InternalAutoTraderBase {

    constructor(
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) InternalAutoTraderBase(_chainId, _dolomiteRegistry, _dolomiteMargin) {
    }

    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        IDolomiteStructs.AccountInfo memory makerAccount,
        IDolomiteStructs.AccountInfo memory takerAccount,
        IDolomiteStructs.Par memory oldInputPar,
        IDolomiteStructs.Par memory newInputPar,
        IDolomiteStructs.Wei memory inputDeltaWei,
        bytes memory data
    ) external override returns (IDolomiteStructs.AssetAmount memory) {
        return IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: inputDeltaWei.value
        });
    }

    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) external view override returns (IDolomiteStructs.ActionArgs[] memory) {
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            actionsLength(_params.trades.length)
        );
        actions[0] = AccountActionLib.encodeCallAction(
            /* accountId = */ 0,
            address(this),
            abi.encode(abi.decode(_params.extraData, (bytes[])), true)
        );
        return actions;
    }

    function actionsLength(uint256 _trades) public pure override returns (uint256) {
        return _trades;
    }
}

