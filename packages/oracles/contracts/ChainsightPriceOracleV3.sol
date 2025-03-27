// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2025 Dolomite.

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
import { IChainsightOracle } from "./interfaces/IChainsightOracle.sol";
import { IChainsightPriceOracleV3 } from "./interfaces/IChainsightPriceOracleV3.sol";
import { IOracleAggregatorV2 } from "./interfaces/IOracleAggregatorV2.sol";


/**
 * @title   ChainsightPriceOracleV3
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chainsight prices compatible with the protocol.
 * This implementation is meant to be tied to an aggregator
 */
contract ChainsightPriceOracleV3 is IChainsightPriceOracleV3, OnlyDolomiteMargin {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "ChainsightPriceOracleV3";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint8 private constant _CHAINSIGHT_PRICE_DECIMALS = 8;

    // ========================= Storage =========================

    mapping(address => bytes32) private _tokenToKeyMap;

    mapping(address => bool) private _tokenToInvertPriceMap;

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    address public chainsightSender;
    IChainsightOracle public chainsightOracle;

    uint256 public stalenessThreshold;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens                  The tokens that are supported by this adapter.
     * @param  _keys                    The Chainsight keys for each token
     * @param  _invertPrice             True if should invert price received from Chronicle
     * @param  _dolomiteRegistry        The address of the DolomiteRegistry contract.
     * @param  _dolomiteMargin          The address of the DolomiteMargin contract.
     */
    constructor(
        address _chainsightOracle,
        address _chainsightSender,
        address[] memory _tokens,
        bytes32[] memory _keys,
        bool[] memory _invertPrice,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        Require.that(
            _tokens.length == _keys.length,
            _FILE,
            "Invalid tokens length"
        );
        Require.that(
            _keys.length == _invertPrice.length,
            _FILE,
            "Invalid keys length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerInsertOrUpdateOracleToken(
                _tokens[i],
                _keys[i],
                _invertPrice[i]
            );
        }

        _ownerSetChainsightOracle(_chainsightOracle);
        _ownerSetChainsightSender(_chainsightSender);
        _ownerSetStalenessThreshold(36 hours);
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ========================= Admin Functions =========================

    function ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetStalenessThreshold(_stalenessThreshold);
    }

    function ownerSetChainsightOracle(
        address _chainsightOracle
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetChainsightOracle(_chainsightOracle);
    }

    function ownerSetChainsightSender(
        address _chainsightSender
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetChainsightSender(_chainsightSender);
    }

    function ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _key,
        bool _invertPrice
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerInsertOrUpdateOracleToken(
            _token,
            _key,
            _invertPrice
        );
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    ) public view returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _tokenToKeyMap[_token] != bytes32(0),
            _FILE,
            "Invalid token",
            _token
        );
        Require.that(
            msg.sender != address(DOLOMITE_MARGIN()),
            _FILE,
            "DolomiteMargin cannot call"
        );

        bytes32 key = _tokenToKeyMap[_token];
        (
            uint256 price,
            uint64 updatedAt
        ) = chainsightOracle.readAsUint256WithTimestamp(
            chainsightSender,
            key
        );
        Require.that(
            block.timestamp - updatedAt < stalenessThreshold,
            _FILE,
            "Chainsight price expired",
            _token,
            updatedAt
        );

        if (_tokenToInvertPriceMap[_token]) {
            uint256 decimalFactor = 10 ** uint256(_CHAINSIGHT_PRICE_DECIMALS);
            price = (decimalFactor ** 2) / price;
        }

        // standardize the Chainsight price to be the proper number of decimals of (36 - tokenDecimals)
        IOracleAggregatorV2 aggregator = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()));
        uint8 tokenDecimals = aggregator.getDecimalsByToken(_token);
        assert(tokenDecimals > 0);
        uint256 standardizedPrice = standardizeNumberOfDecimals(
            tokenDecimals,
            price,
            _CHAINSIGHT_PRICE_DECIMALS
        );

        return IDolomiteStructs.MonetaryPrice({
            value: standardizedPrice
        });
    }

    function getKeyByToken(address _token) public view returns (bytes32) {
        return _tokenToKeyMap[_token];
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
    ) public pure returns (uint) {
        uint256 tokenDecimalsFactor = 10 ** uint256(_tokenDecimals);
        uint256 priceFactor = _ONE_DOLLAR / tokenDecimalsFactor;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }

    // ========================= Internal Functions =========================

    function _ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    ) internal {
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

    function _ownerSetChainsightOracle(
        address _chainsightOracle
    ) internal {
        Require.that(
            _chainsightOracle != address(0),
            _FILE,
            "Invalid chainsight oracle"
        );
        chainsightOracle = IChainsightOracle(_chainsightOracle);
        emit ChainsightOracleUpdated(_chainsightOracle);
    }

    function _ownerSetChainsightSender(
        address _chainsightSender
    ) internal {
        Require.that(
            _chainsightSender != address(0),
            _FILE,
            "Invalid chainsight sender"
        );
        chainsightSender = _chainsightSender;
        emit ChainsightSenderUpdated(_chainsightSender);
    }

    function _ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _key,
        bool _invertPrice
    ) internal {
        _tokenToKeyMap[_token] = _key;
        _tokenToInvertPriceMap[_token] = _invertPrice;
        emit TokenInsertedOrUpdated(_token, _key);
    }
}
