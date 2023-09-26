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

import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IChainlinkAccessControlAggregator } from "../interfaces/chainlink/IChainlinkAccessControlAggregator.sol";
import { IChainlinkAggregator } from "../interfaces/chainlink/IChainlinkAggregator.sol";
import { IChainlinkPriceOracle } from "../interfaces/chainlink/IChainlinkPriceOracle.sol";


/**
 * @title   ChainlinkPriceOracle
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chainlink prices compatible with the protocol.
 */
contract ChainlinkPriceOracle is IChainlinkPriceOracle, OnlyDolomiteMargin {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "ChainlinkPriceOracle";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;

    // ========================= Storage =========================

    mapping(address => IChainlinkAggregator) private _tokenToAggregatorMap;

    mapping(address => uint8) private _tokenToDecimalsMap;

    /// @dev Defaults to USD if the value is the ZERO address
    mapping(address => address) private _tokenToPairingMap;

    uint256 public stalenessThreshold;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens                  The tokens that are supported by this adapter.
     * @param  _chainlinkAggregators    The Chainlink aggregators that have on-chain prices.
     * @param  _tokenDecimals           The number of decimals that each token has.
     * @param  _tokenPairs              The token against which this token's value is compared using the aggregator. The
     *                                  zero address means USD.
     * @param  _dolomiteMargin          The address of the DolomiteMargin contract.
     */
    constructor(
        address[] memory _tokens,
        address[] memory _chainlinkAggregators,
        uint8[] memory _tokenDecimals,
        address[] memory _tokenPairs,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        if (_tokens.length == _chainlinkAggregators.length) { /* FOR COVERAGE TESTING */ }
        Require.that(_tokens.length == _chainlinkAggregators.length,
            _FILE,
            "Invalid tokens length"
        );
        if (_chainlinkAggregators.length == _tokenDecimals.length) { /* FOR COVERAGE TESTING */ }
        Require.that(_chainlinkAggregators.length == _tokenDecimals.length,
            _FILE,
            "Invalid aggregators length"
        );
        if (_tokenDecimals.length == _tokenPairs.length) { /* FOR COVERAGE TESTING */ }
        Require.that(_tokenDecimals.length == _tokenPairs.length,
            _FILE,
            "Invalid decimals length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerInsertOrUpdateOracleToken(
                _tokens[i],
                _tokenDecimals[i],
                _chainlinkAggregators[i],
                _tokenPairs[i]
            );
        }

        _ownerSetStalenessThreshold(36 hours);
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
        uint8 _tokenDecimals,
        address _chainlinkAggregator,
        address _tokenPair
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerInsertOrUpdateOracleToken(
            _token,
            _tokenDecimals,
            _chainlinkAggregator,
            _tokenPair
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
        Require.that(address(_tokenToAggregatorMap[_token]) != address(0),
            _FILE,
            "Invalid token",
            _token
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
        Require.that(block.timestamp - updatedAt < stalenessThreshold,
            _FILE,
            "Chainlink price expired",
            _token
        );

        IChainlinkAccessControlAggregator controlAggregator = aggregatorProxy.aggregator();
        if (controlAggregator.minAnswer() < answer) { /* FOR COVERAGE TESTING */ }
        Require.that(controlAggregator.minAnswer() < answer,
            _FILE,
            "Chainlink price too low"
        );
        if (answer < controlAggregator.maxAnswer()) { /* FOR COVERAGE TESTING */ }
        Require.that(answer < controlAggregator.maxAnswer(),
            _FILE,
            "Chainlink price too high"
        );

        uint256 chainlinkPrice = uint256(answer);
        address tokenPair = _tokenToPairingMap[_token];

        // standardize the Chainlink price to be the proper number of decimals of (36 - tokenDecimals)
        uint256 standardizedPrice = standardizeNumberOfDecimals(
            _tokenToDecimalsMap[_token],
            chainlinkPrice,
            aggregatorProxy.decimals()
        );

        if (tokenPair == address(0)) {
            // The pair has a USD base, we are done.
            return IDolomiteStructs.MonetaryPrice({
                value: standardizedPrice
            });
        } else {
            // The price we just got and converted is NOT against USD. So we need to get its pair's price against USD.
            // We can do so by recursively calling #getPrice using the `tokenPair` as the parameter instead of `token`.
            uint256 tokenPairPrice = getPrice(tokenPair).value;
            // Standardize the price to use 36 decimals.
            uint256 tokenPairWith36Decimals = tokenPairPrice * (10 ** uint256(_tokenToDecimalsMap[tokenPair]));
            // Now that the chained price uses 36 decimals (and thus is standardized), we can do easy math.
            return IDolomiteStructs.MonetaryPrice({
                value: standardizedPrice * tokenPairWith36Decimals / _ONE_DOLLAR
            });
        }
    }

    function getAggregatorByToken(address _token) public view returns (IChainlinkAggregator) {
        return _tokenToAggregatorMap[_token];
    }

    function getDecimalsByToken(address _token) public view returns (uint8) {
        return _tokenToDecimalsMap[_token];
    }

    function getTokenPairByToken(address _token) public view returns (address _tokenPair) {
        return _tokenToPairingMap[_token];
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
        Require.that(_stalenessThreshold >= 24 hours,
            _FILE,
            "Staleness threshold too low",
            _stalenessThreshold
        );
        if (_stalenessThreshold <= 7 days) { /* FOR COVERAGE TESTING */ }
        Require.that(_stalenessThreshold <= 7 days,
            _FILE,
            "Staleness threshold too high",
            _stalenessThreshold
        );

        stalenessThreshold = _stalenessThreshold;
        emit StalenessDurationUpdated(_stalenessThreshold);
    }

    function _ownerInsertOrUpdateOracleToken(
        address _token,
        uint8 _tokenDecimals,
        address _chainlinkAggregator,
        address _tokenPair
    ) internal {
        _tokenToAggregatorMap[_token] = IChainlinkAggregator(_chainlinkAggregator);
        _tokenToDecimalsMap[_token] = _tokenDecimals;
        if (_tokenPair != address(0)) {
            if (address(_tokenToAggregatorMap[_tokenPair]) != address(0)) { /* FOR COVERAGE TESTING */ }
            Require.that(address(_tokenToAggregatorMap[_tokenPair]) != address(0),
                _FILE,
                "Invalid token pair",
                _tokenPair
            );
            // The aggregator's price is NOT against USD. Therefore, we need to store what it's against as well as the
            // # of decimals the aggregator's price has.
            _tokenToPairingMap[_token] = _tokenPair;
        }
        emit TokenInsertedOrUpdated(_token, _chainlinkAggregator, _tokenPair);
    }
}
