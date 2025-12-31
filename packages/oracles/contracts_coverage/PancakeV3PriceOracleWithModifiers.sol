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
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IAlgebraV3Pool } from "./interfaces/IAlgebraV3Pool.sol";
import { IOracleAggregatorV2 } from "./interfaces/IOracleAggregatorV2.sol";
import { ITWAPPriceOracleV1 } from "./interfaces/ITWAPPriceOracleV1.sol";
import { OracleLibrary } from "./utils/OracleLibrary.sol";


/**
 * @title   PancakeV3PriceOracleWithModifiers
 * @author  Dolomite
 *
 * An implementation of the ITWAPPriceOracleV1 interface that makes gets the TWAP from an LP pool. Skips checks in
 * `getPrice` so more than one token price be retrieved. Can also have a minimum price for the `TOKEN`
 */
contract PancakeV3PriceOracleWithModifiers is ITWAPPriceOracleV1, OnlyDolomiteMargin {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ========================= Events =========================

    event FloorPriceUpdated(uint256 floorPrice);

    // ========================= Constants =========================

    bytes32 private constant _FILE = "PancakeV3PriceOracleNoTokenCheck";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint8 private constant _ORACLE_VALUE_DECIMALS = 36;

    // ========================= Storage =========================

    uint32 public observationInterval;
    uint256 public floorPrice;

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
        _ownerSetObservationInterval(15 minutes);
        _ownerSetFloorPrice(0);

        TOKEN_DECIMALS_FACTOR = 10 ** IERC20Metadata(_token).decimals();
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);

        /*assert(IAlgebraV3Pool(_pair).token0() == _token || IAlgebraV3Pool(_pair).token1() == _token);*/
    }

    // ========================= Admin Functions =========================

    function ownerSetObservationInterval(
        uint32 _observationInterval
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetObservationInterval(_observationInterval);
    }

    function ownerSetFloorPrice(
        uint256 _floorPrice
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetFloorPrice(_floorPrice);
    }

    // ========================= Public Functions =========================

    function getPrice(
        address /* _token */
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        IAlgebraV3Pool currentPair = IAlgebraV3Pool(PAIR);

        address poolToken0 = currentPair.token0();
        address outputToken = poolToken0 == TOKEN ? currentPair.token1() : poolToken0;

        int24 tick = OracleLibrary.consultPancakeSwap(address(currentPair), observationInterval);
        uint256 quote = OracleLibrary.getQuoteAtTick(tick, uint128(TOKEN_DECIMALS_FACTOR), TOKEN, outputToken);

        IOracleAggregatorV2 aggregator = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()));
        uint8 outputTokenDecimals = aggregator.getDecimalsByToken(outputToken);
        /*assert(outputTokenDecimals > 0);*/

        IDolomiteStructs.MonetaryPrice memory price = IDolomiteStructs.MonetaryPrice({
            value: _standardizeNumberOfDecimals(quote, outputTokenDecimals)
        });

        if (price.value < floorPrice) {
            price.value = floorPrice;
        }
        return price;
    }

    // ========================= Internal Functions =========================

    function _ownerSetObservationInterval(
        uint32 _observationInterval
    )
    internal {
        observationInterval = _observationInterval;
        emit ObservationIntervalUpdated(_observationInterval);
    }

    function _ownerSetFloorPrice(
        uint256 _floorPrice
    )
    internal {
        floorPrice = _floorPrice;
        emit FloorPriceUpdated(_floorPrice);
    }

    function _standardizeNumberOfDecimals(
        uint256 _value,
        uint8 _valueDecimals
    ) internal view returns (uint) {
        uint256 priceFactor = _ONE_DOLLAR / TOKEN_DECIMALS_FACTOR;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }
}
