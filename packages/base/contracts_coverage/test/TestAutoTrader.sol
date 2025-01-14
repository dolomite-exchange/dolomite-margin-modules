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


/**
 * @title   TestDolomiteAutoTrader
 * @author  Dolomite
 *
 * @notice  A test implementation of IDolomiteAutoTrader
 */
contract TestDolomiteAutoTrader is IDolomiteAutoTrader {

    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        IDolomiteStructs.AccountInfo memory makerAccount,
        IDolomiteStructs.AccountInfo memory takerAccount,
        IDolomiteStructs.Par memory oldInputPar,
        IDolomiteStructs.Par memory newInputPar,
        IDolomiteStructs.Wei memory inputDeltaWei,
        bytes memory data
    ) external pure returns (IDolomiteStructs.AssetAmount memory) {
        return IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: inputDeltaWei.value
        });
    }
}

