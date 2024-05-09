// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2023 Dolomite.

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
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IOracleAggregatorV2 } from "./interfaces/IOracleAggregatorV2.sol";
import { IRamsesPool } from "./interfaces/IRamsesPool.sol";


/**
 * @title   RamsesLegacyPriceOracle
 * @author  Dolomite
 *
 * An implementation of IDolomitePriceOracle that makes gets the TWAP from a Ramses Legacy pool
 */
contract RamsesLegacyPriceOracle is IDolomitePriceOracle, OnlyDolomiteMargin {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "RamsesLegacyPriceOracle";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;

    // ========================= Storage =========================

    address public immutable TOKEN; // solhint-disable-line var-name-mixedcase
    address public immutable PAIR;
    uint256 public immutable TOKEN_DECIMALS_FACTOR; // solhint-disable-line var-name-mixedcase
    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    // ========================= Constructor =========================

    constructor(
        address _token,
        address _pair,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        TOKEN = _token;
        PAIR = _pair;

        TOKEN_DECIMALS_FACTOR = 10 ** IERC20Metadata(_token).decimals();
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == TOKEN,
            _FILE,
            "Invalid token",
            _token
        );

        IRamsesPool currentPair = IRamsesPool(PAIR);
        address token0 = currentPair.token0();
        address outputToken = token0 == _token ? currentPair.token1() : token0;

        uint256 twap = currentPair.current(
            /* tokenIn = */ _token,
            /* amountIn = */ TOKEN_DECIMALS_FACTOR
        );

        IOracleAggregatorV2 aggregator = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()));
        uint8 outputTokenDecimals = aggregator.getDecimalsByToken(outputToken);
        assert(outputTokenDecimals > 0);

        return IDolomiteStructs.MonetaryPrice({
            value: _standardizeNumberOfDecimals(twap, outputTokenDecimals)
        });
    }

    // ========================= Internal Functions =========================

    function _standardizeNumberOfDecimals(
        uint256 _value,
        uint8 _valueDecimals
    ) internal view returns (uint) {
        uint256 priceFactor = _ONE_DOLLAR / TOKEN_DECIMALS_FACTOR;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }
}
