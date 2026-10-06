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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { CappedExchangeRatePriceOracle } from "./CappedExchangeRatePriceOracle.sol";
import { IWeEth } from "./interfaces/IWeEth.sol";


/**
 * @title   CappedEEthExchangeRatePriceOracle
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that gets the capped weETH <> eETH exchange rate
 */
contract CappedEEthExchangeRatePriceOracle is CappedExchangeRatePriceOracle {

    bytes32 private constant _FILE = "CappedEEthExchangeRateOracle";

    IWeEth public immutable WE_ETH;

    constructor(
        address _weEth,
        SetCapParameters memory _params,
        address _dolomiteMargin
    ) CappedExchangeRatePriceOracle(_params, _dolomiteMargin) {
        WE_ETH = IWeEth(_weEth);
    }

    function getPrice(
        address token
    ) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        if (token == address(WE_ETH)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            token == address(WE_ETH),
            _FILE,
            "Invalid token"
        );

        uint256 currentRatio = WE_ETH.getRate();
        uint256 maxRatio = _getMaxRatio();

        if (currentRatio > maxRatio) {
            currentRatio = maxRatio;
        }

        return IDolomiteStructs.MonetaryPrice({
            value: currentRatio
        });
    }
}
