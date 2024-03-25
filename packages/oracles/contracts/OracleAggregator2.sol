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
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IOracleAggregator2 } from "./interfaces/IOracleAggregator2.sol";


/**
 * @title   OracleAggregator2
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chainlink prices compatible with the protocol.
 */
contract OracleAggregator2 is OnlyDolomiteMargin, IOracleAggregator2 {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "OracleAggregator2";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint256 private constant _WEIGHT_TOTAL = 100;

    // ========================= Storage =========================

    mapping(address => TokenInfo) private _tokenInfoMap;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _infos           Info for each token
     * @param  _dolomiteMargin  The address of the DolomiteMargin contract.
     */
    constructor(
        TokenInfo[] memory _infos,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        uint256 infosLength = _infos.length;
        for (uint256 i; i < infosLength; ++i) {
            _ownerInsertOrUpdateToken(
                _infos[i]
            );
        }
    }

    // ========================= Admin Functions =========================

    function ownerInsertOrUpdateToken(
        TokenInfo memory _info
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerInsertOrUpdateToken(
            _info
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
        OracleInfo[] memory oracleInfos = _tokenInfoMap[_token].oracleInfos;
        Require.that(
            oracleInfos.length > 0,
            _FILE,
            "No oracles for token",
            _token
        );

        uint256 priceTotal;
        for (uint256 i; i < oracleInfos.length; ++i) {
            OracleInfo memory oracleInfo = oracleInfos[i];
            IDolomitePriceOracle oracle = IDolomitePriceOracle(oracleInfo.oracle);
            IDolomiteStructs.MonetaryPrice memory price = oracle.getPrice(_token);
            address tokenPair = oracleInfo.tokenPair;

            if (tokenPair == address(0)) {
                priceTotal += price.value * oracleInfo.weight;
            } else {
                IDolomiteStructs.MonetaryPrice memory tokenPairPrice = getPrice(tokenPair);

                // Standardize the price to use 36 decimals.
                uint256 tokenPairDecimals = _tokenInfoMap[tokenPair].decimals;
                assert(tokenPairDecimals > 0);
                uint256 tokenPairWith36Decimals = tokenPairPrice.value * (10 ** tokenPairDecimals);
                // Now that the chained price uses 36 decimals (and thus is standardized), we can do easy math.
                priceTotal += price.value * tokenPairWith36Decimals * oracleInfo.weight / _ONE_DOLLAR;
            }
        }

        return IDolomiteStructs.MonetaryPrice({
            value: priceTotal / _WEIGHT_TOTAL
        });
    }

    function getTokenInfo(address _token) external view returns (TokenInfo memory) {
        return _tokenInfoMap[_token];
    }

    function getDecimalsByToken(address _token) public view returns (uint8 _decimals) {
        return _tokenInfoMap[_token].decimals;
    }

    function getOraclesByToken(address _token) public view returns (OracleInfo[] memory) {
        return _tokenInfoMap[_token].oracleInfos;
    }

    // ========================= Internal Functions =========================

    function _ownerInsertOrUpdateToken(
        TokenInfo memory _info
    ) internal {
        uint256 weightSum;
        delete _tokenInfoMap[_info.token];

        _tokenInfoMap[_info.token].token = _info.token;
        _tokenInfoMap[_info.token].decimals = _info.decimals;
        for (uint256 i; i < _info.oracleInfos.length; ++i) {
            _tokenInfoMap[_info.token].oracleInfos.push(OracleInfo({
                oracle: _info.oracleInfos[i].oracle,
                tokenPair: _info.oracleInfos[i].tokenPair,
                weight: _info.oracleInfos[i].weight
            }));
            weightSum += _info.oracleInfos[i].weight;
        }

        Require.that(
            weightSum == _WEIGHT_TOTAL,
            _FILE,
            "Invalid weights"
        );
        emit TokenInsertedOrUpdated(_info);
    }
}
