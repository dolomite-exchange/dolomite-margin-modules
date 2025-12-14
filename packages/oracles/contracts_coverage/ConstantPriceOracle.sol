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
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IConstantPriceOracle } from "./interfaces/IConstantPriceOracle.sol";


/**
 * @title   ConstantPriceOracle
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that returns a constant price for a given token.
 */
contract ConstantPriceOracle is IConstantPriceOracle, OnlyDolomiteMargin {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "ConstantPriceOracle";

    // ========================= Storage =========================

    mapping(address => uint256) private _tokenToPriceMap;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens                  The tokens that are supported by this oracle.
     * @param  _prices                  The prices for the tokens.
     * @param  _dolomiteMargin          The address of the DolomiteMargin contract.
     */
    constructor(
        address[] memory _tokens,
        uint256[] memory _prices,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        if (_tokens.length == _prices.length) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tokens.length == _prices.length,
            _FILE,
            "Invalid tokens length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerSetTokenPrice(
                _tokens[i],
                _prices[i]
            );
        }
    }

    // ========================= Admin Functions =========================

    /**
     * Sets the price for a token.
     *
     * @dev The price NEEDS to be in 36 - token decimals format.
     *
     * @param _token   The token to set the price for.
     * @param _price   The price to set for the token.
     */
    function ownerSetTokenPrice(
        address _token,
        uint256 _price
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetTokenPrice(_token, _price);
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory)
    {
        uint256 price = _tokenToPriceMap[_token];
        if (price != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            price != 0,
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

        return IDolomiteStructs.MonetaryPrice({
            value: price
        });
    }

    // ========================= Internal Functions =========================

    function _ownerSetTokenPrice(
        address _token,
        uint256 _price
    ) internal {
        if (_token != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _token != address(0),
            _FILE,
            "Invalid token"
        );

        _tokenToPriceMap[_token] = _price;
        emit TokenPriceSet(_token, _price);
    }
}
