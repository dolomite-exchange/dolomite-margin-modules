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

import "hardhat/console.sol";

/**
 * @title   CamelotV3PriceOracleWithModifiers
 * @author  Dolomite
 *
 * Gets the TWAP from an LP pool and sets floor/ceil prices
 */
contract CamelotV3PriceOracleWithModifiers is OnlyDolomiteMargin {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ========================= Events =========================

    event TokenInfoUpdated(address token, TokenInfo tokenInfo);

    // ========================= Constants =========================

    bytes32 private constant _FILE = "CamelotV3PriceOracleWithModifier";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint8 private constant _ORACLE_VALUE_DECIMALS = 36;

    // ========================= Storage =========================

    struct TokenInfo {
        address pair;
        uint8 decimals;
        uint32 observationInterval;
        uint112 minPrice;
        uint112 maxPrice;
    }

    mapping (address => TokenInfo) private _tokenInfos;
    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    // ========================= Constructor =========================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ========================= Admin Functions =========================

    function ownerSetTokenInfo(
        address _token,
        TokenInfo calldata _tokenInfo
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        if (IAlgebraV3Pool(_tokenInfo.pair).token0() == _token|| IAlgebraV3Pool(_tokenInfo.pair).token1() == _token) { /* FOR COVERAGE TESTING */ }
        Require.that(
            IAlgebraV3Pool(_tokenInfo.pair).token0() == _token|| IAlgebraV3Pool(_tokenInfo.pair).token1() == _token,
            _FILE,
            "Invalid pair"
        );
        if (_tokenInfo.decimals > 0 && _tokenInfo.decimals <= 18) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tokenInfo.decimals > 0 && _tokenInfo.decimals <= 18,
            _FILE,
            "Invalid decimals"
        );
        if (_tokenInfo.minPrice > 0 && _tokenInfo.maxPrice < type(uint112).max) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tokenInfo.minPrice > 0 && _tokenInfo.maxPrice < type(uint112).max,
            _FILE,
            "Invalid min or max price"
        );
        if (_tokenInfo.minPrice < _tokenInfo.maxPrice) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tokenInfo.minPrice < _tokenInfo.maxPrice,
            _FILE,
            "Min and max price cross"
        );
        if (_tokenInfo.observationInterval >= 15 minutes) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tokenInfo.observationInterval >= 15 minutes,
            _FILE,
            "Invalid observation interval"
        );

        _tokenInfos[_token] = _tokenInfo;
        emit TokenInfoUpdated(_token, _tokenInfo);
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        TokenInfo memory tokenInfo = getTokenInfo(_token);

        IAlgebraV3Pool currentPair = IAlgebraV3Pool(tokenInfo.pair);

        address outputToken;
        {
            address poolToken0 = currentPair.token0();
            outputToken = poolToken0 == _token ? currentPair.token1() : poolToken0;
        }

        uint128 tokenDecimalsFactor = uint128(10 ** uint256(tokenInfo.decimals)); // Safe cast; decimals <= 18
        int24 tick = OracleLibrary.consultAlgebraPool(address(currentPair), tokenInfo.observationInterval);
        uint256 quote = OracleLibrary.getQuoteAtTick(tick, tokenDecimalsFactor, _token, outputToken);

        IOracleAggregatorV2 aggregator = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()));
        uint8 outputTokenDecimals = aggregator.getDecimalsByToken(outputToken);
        /*assert(outputTokenDecimals != 0);*/

        IDolomiteStructs.MonetaryPrice memory price = IDolomiteStructs.MonetaryPrice({
            value: _standardizeNumberOfDecimals(quote, outputTokenDecimals, tokenDecimalsFactor)
        });

        if (price.value > tokenInfo.minPrice) { /* FOR COVERAGE TESTING */ }
        Require.that(
            price.value > tokenInfo.minPrice,
            _FILE,
            "Price too low"
        );
        if (price.value < tokenInfo.maxPrice) { /* FOR COVERAGE TESTING */ }
        Require.that(
            price.value < tokenInfo.maxPrice,
            _FILE,
            "Price too large"
        );
        return price;
    }

    function getTokenInfo(address _token) public view returns (TokenInfo memory) {
        TokenInfo memory tokenInfo = _tokenInfos[_token];
        if (tokenInfo.pair != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            tokenInfo.pair != address(0),
            _FILE,
            "Invalid token",
            _token
        );
        return tokenInfo;
    }

    // ========================= Internal Functions =========================

    function _standardizeNumberOfDecimals(
        uint256 _value,
        uint8 _valueDecimals,
        uint256 _tokenDecimalsFactor
    ) internal pure returns (uint) {
        uint256 priceFactor = _ONE_DOLLAR / _tokenDecimalsFactor;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }
}
