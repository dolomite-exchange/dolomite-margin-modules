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
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IAlgebraV3Pool } from "./interfaces/IAlgebraV3Pool.sol";
import { ITWAPPriceOracleV1 } from "./interfaces/ITWAPPriceOracleV1.sol";
import { OracleLibrary } from "./utils/OracleLibrary.sol";


/**
 * @title   TWAPPriceOracleV1.sol
 * @author  Dolomite
 *
 * An implementation of the ITWAPPriceOracleV1.sol interface that makes gets the TWAP from a number of LP pools
 */
contract TWAPPriceOracleV1 is ITWAPPriceOracleV1, OnlyDolomiteMargin {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ========================= Constants =========================

    bytes32 private constant _FILE = "TWAPPriceOracleV1";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint8 private constant _ORACLE_VALUE_DECIMALS = 36;

    // ========================= Storage =========================

    EnumerableSet.AddressSet private _pairs;

    uint32 public observationInterval;

    address public immutable TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 public immutable TOKEN_DECIMALS_FACTOR; // solhint-disable-line var-name-mixedcase

    // ========================= Constructor =========================

    constructor(
        address _token,
        address[] memory _tokenPairs,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        TOKEN = _token;
        for (uint256 i; i < _tokenPairs.length; ++i) {
            _ownerAddPair(_tokenPairs[i]);
        }
        _ownerSetObservationInterval(15 minutes);

        TOKEN_DECIMALS_FACTOR = 10 ** IERC20Metadata(_token).decimals();
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
        address _pair
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerAddPair(_pair);
    }

    function ownerRemovePair(
        address _pairAddress
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerRemovePair(_pairAddress);
    }

    // ========================= Public Functions =========================

    function getPairs() external view returns (address[] memory) {
        return _pairs.values();
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        uint256 len = _pairs.length();
        Require.that(
            _token == TOKEN,
            _FILE,
            "Invalid token",
            _token
        );
        Require.that(
            len > 0,
            _FILE,
            "Oracle contains no pairs"
        );

        uint256 totalPrice;
        for (uint256 i; i < len; ++i) {
            IAlgebraV3Pool currentPair = IAlgebraV3Pool(_pairs.at(i));

            address poolToken0 = currentPair.token0();
            address outputToken = poolToken0 == _token ? currentPair.token1() : poolToken0;

            int24 tick = OracleLibrary.consult(address(currentPair), observationInterval);
            uint256 quote = OracleLibrary.getQuoteAtTick(tick, uint128(TOKEN_DECIMALS_FACTOR), _token, outputToken);
            IDolomiteStructs.MonetaryPrice memory price =
                DOLOMITE_MARGIN().getMarketPrice(DOLOMITE_MARGIN().getMarketIdByTokenAddress(outputToken));

            totalPrice += _standardizeNumberOfDecimals(price.value * quote, _ORACLE_VALUE_DECIMALS);
        }

        return IDolomiteStructs.MonetaryPrice({
            value: totalPrice / len
        });
    }

    // ========================= Internal Functions =========================

    function _ownerAddPair(
        address _pair
    )
    internal {
        IAlgebraV3Pool pool = IAlgebraV3Pool(_pair);
        Require.that(
            pool.token0() == TOKEN || pool.token1() == TOKEN,
            _FILE,
            "Pair must contain oracle token"
        );
        _pairs.add(_pair);
        emit PairAdded(_pair);
    }

    function _ownerRemovePair(
        address _pairAddress
    )
    internal {
        _pairs.remove(_pairAddress);
        emit PairRemoved(_pairAddress);
    }

    function _ownerSetObservationInterval(
        uint32 _observationInterval
    )
    internal {
        observationInterval = _observationInterval;
        emit ObservationIntervalUpdated(_observationInterval);
    }

    function _standardizeNumberOfDecimals(
        uint256 _value,
        uint8 _valueDecimals
    ) internal view returns (uint) {
        uint256 priceFactor = _ONE_DOLLAR / TOKEN_DECIMALS_FACTOR;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }
}
