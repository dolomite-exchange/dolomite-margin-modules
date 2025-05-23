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
import { IChainlinkAggregator } from "./interfaces/IChainlinkAggregator.sol";
import { IChaosLabsPriceOracleV3 } from "./interfaces/IChaosLabsPriceOracleV3.sol";
import { IOracleAggregatorV2 } from "./interfaces/IOracleAggregatorV2.sol";


/**
 * @title   ChaosLabsPriceOracleV3
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chaos Labs prices compatible with the protocol.
 * This implementation is meant to be tied to an
 */
contract ChaosLabsPriceOracleV3 is IChaosLabsPriceOracleV3, OnlyDolomiteMargin {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "ChaosLabsPriceOracleV3";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;

    // ========================= Storage =========================

    mapping(address => IChainlinkAggregator) private _tokenToAggregatorMap;

    mapping(address => bool) private _tokenToInvertPriceMap;

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    uint256 public stalenessThreshold;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens                  The tokens that are supported by this adapter.
     * @param  _chainlinkAggregators    The Chainlink aggregators that have on-chain prices.
     * @param  _invertPrice             True if should invert price received from Chainlink
     * @param  _dolomiteRegistry        The address of the DolomiteRegistry contract.
     * @param  _dolomiteMargin          The address of the DolomiteMargin contract.
     */
    constructor(
        address[] memory _tokens,
        address[] memory _chainlinkAggregators,
        bool[] memory _invertPrice,
        address _dolomiteRegistry,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        if (_tokens.length == _chainlinkAggregators.length) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tokens.length == _chainlinkAggregators.length,
            _FILE,
            "Invalid tokens length"
        );
        if (_chainlinkAggregators.length == _invertPrice.length) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _chainlinkAggregators.length == _invertPrice.length,
            _FILE,
            "Invalid aggregators length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerInsertOrUpdateOracleToken(
                _tokens[i],
                _chainlinkAggregators[i],
                _invertPrice[i]
            );
        }

        _ownerSetStalenessThreshold(36 hours);
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ========================= Admin Functions =========================

    function ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetStalenessThreshold(_stalenessThreshold);
    }

    function ownerInsertOrUpdateOracleToken(
        address _token,
        address _chainlinkAggregator,
        bool _invertPrice
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerInsertOrUpdateOracleToken(
            _token,
            _chainlinkAggregator,
            _invertPrice
        );
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory)
    {
        if (address(_tokenToAggregatorMap[_token]) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            address(_tokenToAggregatorMap[_token]) != address(0),
            _FILE,
            "Invalid token",
            _token
        );
        if (msg.sender != address(DOLOMITE_MARGIN())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender != address(DOLOMITE_MARGIN()),
            _FILE,
            "DolomiteMargin cannot call"
        );

        IChainlinkAggregator aggregatorProxy = _tokenToAggregatorMap[_token];
        (
            /* uint80 roundId */,
            int256 answer,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = aggregatorProxy.latestRoundData();
        if (block.timestamp - updatedAt < stalenessThreshold) { /* FOR COVERAGE TESTING */ }
        Require.that(
            block.timestamp - updatedAt < stalenessThreshold,
            _FILE,
            "Chaos Labs price expired",
            _token,
            updatedAt
        );

        uint256 chaosLabsPrice = uint256(answer);
        uint8 valueDecimals = aggregatorProxy.decimals();

        if (_tokenToInvertPriceMap[_token]) {
            uint256 decimalFactor = 10 ** uint256(valueDecimals);
            chaosLabsPrice = (decimalFactor ** 2) / chaosLabsPrice;
        }

        // standardize the price to be the proper number of decimals of (36 - tokenDecimals)
        IOracleAggregatorV2 aggregator = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()));
        uint8 tokenDecimals = aggregator.getDecimalsByToken(_token);
        /*assert(tokenDecimals > 0);*/
        uint256 standardizedPrice = standardizeNumberOfDecimals(
            tokenDecimals,
            chaosLabsPrice,
            valueDecimals
        );

        return IDolomiteStructs.MonetaryPrice({
            value: standardizedPrice
        });
    }

    function getAggregatorByToken(address _token) public view returns (IChainlinkAggregator) {
        return _tokenToAggregatorMap[_token];
    }

    function getInvertPriceByToken(address _token) public view returns (bool _invertPrice) {
        return _tokenToInvertPriceMap[_token];
    }

    /**
     * Standardizes `value` to have `ONE_DOLLAR.decimals` - `tokenDecimals` number of decimals.
     */
    function standardizeNumberOfDecimals(
        uint8 _tokenDecimals,
        uint256 _value,
        uint8 _valueDecimals
    )
        public
        pure
        returns (uint)
    {
        uint256 tokenDecimalsFactor = 10 ** uint256(_tokenDecimals);
        uint256 priceFactor = _ONE_DOLLAR / tokenDecimalsFactor;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }

    // ========================= Internal Functions =========================

    function _ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    )
    internal
    {
        if (_stalenessThreshold >= 24 hours) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _stalenessThreshold >= 24 hours,
            _FILE,
            "Staleness threshold too low",
            _stalenessThreshold
        );
        if (_stalenessThreshold <= 7 days) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _stalenessThreshold <= 7 days,
            _FILE,
            "Staleness threshold too high",
            _stalenessThreshold
        );

        stalenessThreshold = _stalenessThreshold;
        emit StalenessDurationUpdated(_stalenessThreshold);
    }

    function _ownerInsertOrUpdateOracleToken(
        address _token,
        address _chainlinkAggregator,
        bool _invertPrice
    ) internal {
        _tokenToAggregatorMap[_token] = IChainlinkAggregator(_chainlinkAggregator);
        _tokenToInvertPriceMap[_token] = _invertPrice;
        emit TokenInsertedOrUpdated(_token, _chainlinkAggregator);
    }
}
