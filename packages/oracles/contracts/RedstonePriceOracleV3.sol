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
import { IOracleAggregatorV2 } from "./interfaces/IOracleAggregatorV2.sol";
import { IRedstonePriceOracleV3 } from "./interfaces/IRedstonePriceOracleV3.sol";


/**
 * @title   RedstonePriceOracleV3
 * @author  Dolomite
 * @dev     Redstone oracles have the same interface as Chainlink oracles
 *
 * An implementation of the IDolomitePriceOracle interface that makes Redstone prices compatible with oracle aggregator
 */
contract RedstonePriceOracleV3 is IRedstonePriceOracleV3, OnlyDolomiteMargin {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "RedstonePriceOracleV3";
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
        Require.that(
            _tokens.length == _chainlinkAggregators.length,
            _FILE,
            "Invalid tokens length"
        );
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
        Require.that(
            address(_tokenToAggregatorMap[_token]) != address(0),
            _FILE,
            "Invalid token",
            _token
        );
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
        Require.that(
            block.timestamp - updatedAt < stalenessThreshold,
            _FILE,
            "Price expired",
            _token
        );

        uint256 chainlinkPrice = uint256(answer);
        uint8 valueDecimals = aggregatorProxy.decimals();

        if (_tokenToInvertPriceMap[_token]) {
            uint256 decimalFactor = 10 ** uint256(valueDecimals);
            chainlinkPrice = (decimalFactor ** 2) / chainlinkPrice;
        }

        // standardize the Chainlink price to be the proper number of decimals of (36 - tokenDecimals)
        IOracleAggregatorV2 aggregator = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()));
        uint8 tokenDecimals = aggregator.getDecimalsByToken(_token);
        assert(tokenDecimals > 0);
        uint256 standardizedPrice = standardizeNumberOfDecimals(
            tokenDecimals,
            chainlinkPrice,
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
        Require.that(
            _stalenessThreshold >= 24 hours,
            _FILE,
            "Staleness threshold too low",
            _stalenessThreshold
        );
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
