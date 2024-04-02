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
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IChainlinkPriceOracleV3 } from "./interfaces/IChainlinkPriceOracleV3.sol";
import { IOracleAggregatorV1 } from "./interfaces/IOracleAggregatorV1.sol";


/**
 * @title   OracleAggregatorV1
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chainlink prices compatible with the protocol.
 */
contract OracleAggregatorV1 is OnlyDolomiteMargin, IOracleAggregatorV1 {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "OracleAggregatorV1";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;

    // ========================= Storage =========================

    mapping(address => IChainlinkPriceOracleV3) private _tokenToOracleMap;

    /// @dev Defaults to USD if the value is the ZERO address
    mapping(address => address) private _tokenToPairingMap;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens          The tokens that are supported by this adapter.
     * @param  _oracles         The Chainlink aggregators that have on-chain prices.
     * @param  _tokenPairs      The token against which this token's value is compared using the aggregator. The
     *                          zero address means USD.
     * @param  _dolomiteMargin  The address of the DolomiteMargin contract.
     */
    constructor(
        address[] memory _tokens,
        address[] memory _oracles,
        address[] memory _tokenPairs,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        Require.that(
            _tokens.length == _oracles.length,
            _FILE,
            "Invalid tokens length"
        );
        Require.that(
            _oracles.length == _tokenPairs.length,
            _FILE,
            "Invalid oracles length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerInsertOrUpdateOracle(
                _tokens[i],
                _oracles[i],
                _tokenPairs[i]
            );
        }
    }

    // ========================= Admin Functions =========================

    function ownerInsertOrUpdateOracle(
        address _token,
        address _oracle,
        address _tokenPair
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerInsertOrUpdateOracle(
            _token,
            _oracle,
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
        Require.that(
            address(_tokenToOracleMap[_token]) != address(0),
            _FILE,
            "Invalid token",
            _token
        );
        IChainlinkPriceOracleV3 oracle = _tokenToOracleMap[_token];

        IDolomiteStructs.MonetaryPrice memory price = oracle.getPrice(_token);
        address tokenPair = _tokenToPairingMap[_token];

        if (tokenPair == address(0)) {
            return price;
        } else {
            IDolomiteStructs.MonetaryPrice memory tokenPairPrice = getPrice(tokenPair);

            // Standardize the price to use 36 decimals.
            uint256 tokenPairDecimals = _tokenToOracleMap[tokenPair].getDecimalsByToken(tokenPair);
            uint256 tokenPairWith36Decimals = tokenPairPrice.value * (10 ** tokenPairDecimals);
            // Now that the chained price uses 36 decimals (and thus is standardized), we can do easy math.
            return IDolomiteStructs.MonetaryPrice({
                value: price.value * tokenPairWith36Decimals / _ONE_DOLLAR
            });

        }
    }

    function getOracleByToken(address _token) public view returns (IChainlinkPriceOracleV3) {
        return _tokenToOracleMap[_token];
    }

    function getTokenPairByToken(address _token) public view returns (address _tokenPair) {
        return _tokenToPairingMap[_token];
    }

    // ========================= Internal Functions =========================

    function _ownerInsertOrUpdateOracle(
        address _token,
        address _oracle,
        address _tokenPair
    ) internal {
        _tokenToOracleMap[_token] = IChainlinkPriceOracleV3(_oracle);
        _tokenToPairingMap[_token] = _tokenPair;
        emit TokenInsertedOrUpdated(_token, _oracle, _tokenPair);
    }
}
