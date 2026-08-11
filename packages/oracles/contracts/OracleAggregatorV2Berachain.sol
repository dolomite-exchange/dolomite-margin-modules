// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2024 Dolomite.

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

import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { OracleAggregatorV2 } from "./OracleAggregatorV2.sol";


/**
 * @title   OracleAggregatorV2Berachain
 * @author  Dolomite
 *
 * An implementation of the OracleAggregatorV2 that adds a gas price check for Berachain.
 */
contract OracleAggregatorV2Berachain is OracleAggregatorV2 {

    // ========================= Constants =========================

    bytes32 private constant _FILE = "OracleAggregatorV2Berachain";
    uint256 private constant _WBERA_MARKET_ID = 1;
    uint256 private constant _ONE_BERA = 1 ether;

    // ========================= Storage =========================

    uint256 public gasLimit;

    // ========================= Events =========================

    event GasLimitUpdated(uint256 gasLimit);

    // ========================= Constructor =========================

    constructor(
        TokenInfo[] memory _infos,
        address _dolomiteMargin,
        uint256 _gasLimit
    )
        OracleAggregatorV2(_infos, _dolomiteMargin)
    {
        assert(block.chainid == 80094);

        gasLimit = _gasLimit;
        emit GasLimitUpdated(_gasLimit);
    }

    // ========================= Admin Functions =========================

    function ownerSetGasLimit(
        uint256 _gasLimit
    )
    external
    onlyDolomiteMarginOwner(msg.sender)
    {
        gasLimit = _gasLimit;
        emit GasLimitUpdated(_gasLimit);
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    )
    public
    view
    override
    returns (IDolomiteStructs.MonetaryPrice memory)
    {
        IDolomiteStructs.MonetaryPrice memory tokenPrice = super.getPrice(_token);

        uint8 tokenDecimals = getDecimalsByToken(_token);
        uint256 gasPrice = tx.gasprice;
        if (tokenDecimals < 18 && gasPrice != 0) {
            uint256 beraPrice = DOLOMITE_MARGIN().getMarketPrice(_WBERA_MARKET_ID).value;
            Require.that(
                gasPrice * gasLimit * beraPrice / _ONE_BERA >= tokenPrice.value * _ONE_BERA / _ONE_DOLLAR,
                _FILE,
                "Gas price too low",
                _token
            );
        }

        return tokenPrice;
    }
}
