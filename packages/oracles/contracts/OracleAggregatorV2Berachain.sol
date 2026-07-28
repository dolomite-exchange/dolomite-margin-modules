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

import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { OracleAggregatorV2 } from "./OracleAggregatorV2.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";


/**
 * @title   OracleAggregatorV2Berachain
 * @author  Dolomite
 *
 * An implementation of the OracleAggregatorV2 that adds a gas price check for Berachain.
 */
contract OracleAggregatorV2Berachain is OracleAggregatorV2 {
    using TypesLib for IDolomiteStructs.Wei;

    // ========================= Constants =========================

    bytes32 private constant _FILE = "OracleAggregatorV2Berachain";
    uint256 private constant _WBERA_MARKET_ID = 1;
    uint256 private constant _ONE_BERA = 1 ether;

    // ========================= Structs =========================

    struct Snapshot {
        bool sign;
        uint128 value;
        uint64 timestamp;
    }

    // ========================= Storage =========================

    uint256 public gasLimit;
    mapping(address => Snapshot) private _tokenToExcessBalanceSnapshot;



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

        for (uint256 i; i < _infos.length; ++i) {
            _snapshotExcessEarningsSnapshot(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_infos[i].token));
        }
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

    function snapshotExcessEarningsSnapshot(address[] calldata _marketIds) external {
        uint256 marketIdsLength = _marketIds.length;
        for (uint256 i; i < marketIdsLength; ++i) {
            _snapshotExcessEarningsSnapshot(_marketIds[i]);
        }
    }

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
        if (tokenDecimals < 18) {
            Snapshot memory snapshot = _tokenToExcessBalanceSnapshot[_token];
            IDolomiteStructs.Wei memory oldExcess = IDolomiteStructs.Wei({
                sign: snapshot.sign,
                value: snapshot.value
            });
            uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token);
            IDolomiteStructs.Wei memory diff = DOLOMITE_MARGIN().getNumExcessTokens(marketId).sub(oldExcess);

            if (!_isAcceptableDiff(diff) && gasPrice != 0) {
                uint256 beraPrice = DOLOMITE_MARGIN().getMarketPrice(_WBERA_MARKET_ID).value;
                Require.that(
                    gasPrice * gasLimit * beraPrice / _ONE_BERA >= tokenPrice.value * _ONE_BERA / _ONE_DOLLAR,
                    _FILE,
                    "Gas price too low",
                    _token,
                    gasPrice
                );
            }
        }

        return tokenPrice;
    }

    // ========================= Internal Functions =========================

    function _isAcceptableDiff(IDolomiteStructs.Wei memory _diff) internal pure returns (bool) {
        // _diff >= -1
        return _diff.sign || _diff.value <= 1;
    }

    function _snapshotExcessEarningsSnapshot(uint256 _marketId) internal {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        Require.that(
            _tokenToExcessBalanceSnapshot[token].timestamp + 10 seconds <= block.timestamp,
            _FILE,
            "Already snapshot",
            _marketId
        );

        IDolomiteStructs.Wei memory excess = DOLOMITE_MARGIN().getNumExcessTokens(_marketId);
        _tokenToExcessBalanceSnapshot[token] = Snapshot({
            sign: excess.sign,
            value: uint128(excess.value),
            timestamp: uint64(block.timestamp)
        });
        emit MarketExcessBalanceSnapshot(_marketId, excess);
    }
}
