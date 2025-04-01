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

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { InternalAutoTraderBase } from "../traders/InternalAutoTraderBase.sol";


/**
 * @title   TestDolomiteAutoTrader
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
        uint256 /* _inputMarketId */,
        uint256 /* _outputMarketId */,
        IDolomiteStructs.AccountInfo calldata /* _makerAccount */,
        IDolomiteStructs.AccountInfo calldata /* _takerAccount */,
        IDolomiteStructs.Par calldata /* _oldInputPar */,
        IDolomiteStructs.Par calldata /* _newInputPar */,
        IDolomiteStructs.Wei calldata _inputDeltaWei,
        bytes calldata /* _data */
    ) external pure override returns (IDolomiteStructs.AssetAmount memory) {
        return IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _inputDeltaWei.value
        });
    }

    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) external view override returns (IDolomiteStructs.ActionArgs[] memory) {
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            actionsLength(_params.trades)
        );
        actions[0] = AccountActionLib.encodeCallAction(
            /* accountId = */ 0,
            address(this),
            abi.encode(abi.decode(_params.extraData, (bytes[])), true)
        );
        return actions;
    }

    function actionsLength(InternalTradeParams[] memory _trades) public pure override returns (uint256) {
        return _trades.length;
    }
}

