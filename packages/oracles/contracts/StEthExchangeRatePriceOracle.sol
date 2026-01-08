// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { ILido } from "./interfaces/ILido.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";


/**
 * @title   StEthExchangeRatePriceOracle
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that gets the wstETH <> stETH exchange rate
 */
contract StEthExchangeRatePriceOracle is IDolomitePriceOracle, OnlyDolomiteMargin {

    bytes32 private constant _FILE = "StEthExchangeRatePriceOracle";

    ILido public immutable LIDO;
    address public immutable WST_ETH;

    constructor(address _lido, address _wstEth, address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {
        LIDO = ILido(_lido);
        WST_ETH = _wstEth;
    }

    function getPrice(
        address token
    ) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            token == WST_ETH,
            _FILE,
            "Invalid token"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: LIDO.getPooledEthByShares(1 ether)
        });
    }
}