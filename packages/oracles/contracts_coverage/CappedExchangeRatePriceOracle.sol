// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite.

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
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ICappedExchangeRatePriceOracle } from "./interfaces/ICappedExchangeRatePriceOracle.sol";


/**
 * @title   CappedExchangeRatePriceOracle
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that gets a capped exchange rate price oracle
 */
abstract contract CappedExchangeRatePriceOracle is ICappedExchangeRatePriceOracle, OnlyDolomiteMargin {

    bytes32 private constant _FILE = "CappedExchangeRateOracle";

    uint256 private constant _MINIMUM_SNAPSHOT_DELAY = 604800; // 7 days
    uint256 private constant _SECONDS_PER_YEAR = 31536000;

    uint256 public snapshotRatio;
    uint256 public snapshotTimestamp;
    uint256 public maxGrowthPerSecond;

    constructor(
        SetCapParameters memory _params,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        _ownerSetCapParameters(_params);
    }

    function ownerSetCapParameters(SetCapParameters memory _params) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetCapParameters(_params);
    }

    function _ownerSetCapParameters(SetCapParameters memory _params) internal {
        if (_params.snapshotRatio != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _params.snapshotRatio != 0,
            _FILE,
            "Snapshot ratio cannot be 0"
        );
        if (_params.snapshotTimestamp > snapshotTimestamp && _params.snapshotTimestamp < block.timestamp - _MINIMUM_SNAPSHOT_DELAY) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _params.snapshotTimestamp > snapshotTimestamp
            && _params.snapshotTimestamp < block.timestamp - _MINIMUM_SNAPSHOT_DELAY,
            _FILE,
            "Invalid snapshot timestamp"
        );

        snapshotRatio = _params.snapshotRatio;
        snapshotTimestamp = _params.snapshotTimestamp;
        maxGrowthPerSecond = snapshotRatio * _params.maxGrowthPerYear / 1e18 / _SECONDS_PER_YEAR;

        emit CapParametersSet(snapshotRatio, snapshotTimestamp, maxGrowthPerSecond);
    }

    function _getMaxRatio() internal view returns (uint256) {
        return snapshotRatio + maxGrowthPerSecond * (block.timestamp - snapshotTimestamp);
    }
}
