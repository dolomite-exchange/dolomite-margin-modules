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

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { ITWAPPriceOracle } from "../interfaces/ITWAPPriceOracle.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { ICamelotV3Pool } from "../interfaces/camelot/ICamelotV3Pool.sol";
import { OracleLibrary } from "../lib/OracleLibrary.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";


/**
 * @title   TWAPPriceOracle
 * @author  Dolomite
 *
 * An implementation of the ITWAPPriceOracle interface that makes gets the TWAP from a number of LP pools
 */
contract TWAPPriceOracle is ITWAPPriceOracle, OnlyDolomiteMargin {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ========================= Constants =========================

    bytes32 private constant _FILE = "TWAPPriceOracle";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint8 private constant _ORACLE_VALUE_DECIMALS = 36;

    // ========================= Storage =========================

    EnumerableSet.AddressSet private _pairs;
    mapping(address => PairVersion) private _pairToVersion;

    address public token;
    uint32 public observationInterval = 15 minutes;

    // ========================= Constructor =========================

    /**
     *
     * @param  _token                  The tokens that are supported by this adapter.
     * @param  _tokenPairs              The token against which this token's value is compared using the aggregator. The
     *                                  zero address means USD.
     * @param  _dolomiteMargin          The address of the DolomiteMargin contract.
     */
    constructor(
        address _token,
        PairInfo[] memory _tokenPairs,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        token = _token;
        for (uint256 i; i < _tokenPairs.length; i++) {
            _ownerAddPair(_tokenPairs[i]);
        }
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

    function ownerAddPair(
        PairInfo memory _pair
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerAddPair(_pair);
    }

    function ownerRemovePair(
        address _pairAddress
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerRemovePair(_pairAddress);
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory)
    {
        uint256 len = _pairs.length();
        if (_token == token) { /* FOR COVERAGE TESTING */ }
        Require.that(_token == token,
            _FILE,
            "Invalid token",
            _token
        );
        if (len > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(len > 0,
            _FILE,
            'Oracle contains no pairs'
        );

        uint256 totalPrice;
        for (uint256 i; i < len; i++) {
            ICamelotV3Pool currentPair = ICamelotV3Pool(_pairs.at(i));

            if (_pairToVersion[address(currentPair)] == PairVersion.V3) {
                address poolToken0 = currentPair.token0();
                address outputToken = poolToken0 == _token ? currentPair.token1() : poolToken0;
                uint8 tokenDecimals = IERC20Metadata(_token).decimals();

                int24 tick = OracleLibrary.consult(address(currentPair), observationInterval);
                uint256 quote = OracleLibrary.getQuoteAtTick(tick, uint128(10 ** tokenDecimals), _token, outputToken);
                IDolomiteStructs.MonetaryPrice memory price = DOLOMITE_MARGIN().getMarketPrice(DOLOMITE_MARGIN().getMarketIdByTokenAddress(outputToken));

                totalPrice += standardizeNumberOfDecimals(tokenDecimals, price.value * quote, _ORACLE_VALUE_DECIMALS);
            } else {
                // @follow-up Do we want to do v2 pools since they don't have priceCumulative
                revert();
            }
        }

        return IDolomiteStructs.MonetaryPrice({
            value: totalPrice / len
        });
    }

    function getPairs() external view returns (address[] memory) {
        return _pairs.values();
    }

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

    function _ownerAddPair(
        PairInfo memory _pair
    )
    internal {
        ICamelotV3Pool pool = ICamelotV3Pool(_pair.pairAddress);
        if (pool.token0() == token || pool.token1() == token) { /* FOR COVERAGE TESTING */ }
        Require.that(pool.token0() == token || pool.token1() == token,
            _FILE,
            "Pair must contain oracle token"
        );
        _pairs.add(_pair.pairAddress);
        _pairToVersion[_pair.pairAddress] = _pair.pairVersion;
        emit PairAdded(_pair.pairAddress);
    }

    function _ownerRemovePair(
        address _pairAddress
    )
    internal {
        _pairs.remove(_pairAddress);
        delete _pairToVersion[_pairAddress];
        emit PairRemoved(_pairAddress);
    }

    function _ownerSetObservationInterval(
        uint32 _observationInterval
    )
    internal
    {
        observationInterval = _observationInterval;
        emit ObservationIntervalUpdated(_observationInterval);
    }
}
