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
import { IChainlinkAccessControlAggregator } from "./interfaces/IChainlinkAccessControlAggregator.sol";
import { IChainlinkAggregator } from "./interfaces/IChainlinkAggregator.sol";
import { IChainlinkPriceOracleV2 } from "./interfaces/IChainlinkPriceOracleV2.sol";


/**
 * @title   OracleAggregator
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chainlink prices compatible with the protocol.
 */
contract OracleAggregator is OnlyDolomiteMargin {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "OracleAggregator";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;

    // ========================= Storage =========================

    mapping(address => IChainlinkPriceOracleV2) private _tokenToOracleMap;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens                  The tokens that are supported by this adapter.
     * @param  _oracles    The Chainlink aggregators that have on-chain prices.
     * @param  _dolomiteMargin          The address of the DolomiteMargin contract.
     */
    constructor(
        address[] memory _tokens,
        address[] memory _oracles,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        Require.that(
            _tokens.length == _oracles.length,
            _FILE,
            "Invalid tokens length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerInsertOrUpdateOracle(
                _tokens[i],
                _oracles[i]
            );
        }
    }

    // ========================= Admin Functions =========================

    function ownerInsertOrUpdateOracle(
        address _token,
        address _oracle
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerInsertOrUpdateOracle(
            _token,
            _oracle
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
        IChainlinkPriceOracleV2 oracle = _tokenToOracleMap[_token];

        IDolomiteStructs.MonetaryPrice memory price = oracle.getPrice(_token);
        address tokenPair = oracle.getTokenPairByToken(_token);
        uint256 tokenPairDecimals = oracle.getDecimalsByToken(tokenPair);

        if (tokenPair == address(0)) {
            return price;
        } else {
            IDolomiteStructs.MonetaryPrice memory tokenPairPrice = getPrice(tokenPair);
            // Standardize the price to use 36 decimals.
            uint256 tokenPairWith36Decimals = tokenPairPrice.value * (10 ** tokenPairDecimals);
            // Now that the chained price uses 36 decimals (and thus is standardized), we can do easy math.
            return IDolomiteStructs.MonetaryPrice({
                value: price.value * tokenPairWith36Decimals / _ONE_DOLLAR
            });
            
        }
    }

    function getOracleByToken(address _token) public view returns (IChainlinkPriceOracleV2) {
        return _tokenToOracleMap[_token];
    }

    // ========================= Internal Functions =========================

    function _ownerInsertOrUpdateOracle(
        address _token,
        address _oracle
    ) internal {
        _tokenToOracleMap[_token] = IChainlinkPriceOracleV2(_oracle);
    }
}