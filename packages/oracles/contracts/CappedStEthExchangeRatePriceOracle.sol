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
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ICappedStEthExchangeRatePriceOracle } from "./interfaces/ICappedStEthExchangeRatePriceOracle.sol";
import { ILido } from "./interfaces/ILido.sol";


/**
 * @title   CappedStEthExchangeRatePriceOracle
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that gets the capped wstETH <> stETH exchange rate
 */
contract CappedStEthExchangeRatePriceOracle is ICappedStEthExchangeRatePriceOracle, OnlyDolomiteMargin {

    bytes32 private constant _FILE = "CappedStEthExchangeRateOracle";

    uint256 private constant _MINIMUM_SNAPSHOT_DELAY = 604800; // 7 days
    uint256 private constant _SECONDS_PER_YEAR = 31536000;

    ILido public immutable LIDO;
    address public immutable WST_ETH;

    uint256 public snapshotRatio;
    uint256 public snapshotTimestamp;
    uint256 public maxGrowthPerSecond;

    constructor(
        address _lido,
        address _wstEth,
        SetCapParameters memory _params,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        LIDO = ILido(_lido);
        WST_ETH = _wstEth;

        _ownerSetCapParameters(_params);
    }

    function ownerSetCapParameters(SetCapParameters memory _params) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetCapParameters(_params);
    }

    function getPrice(
        address token
    ) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            token == WST_ETH,
            _FILE,
            "Invalid token"
        );

        uint256 currentRatio = LIDO.getPooledEthByShares(1 ether);
        uint256 maxRatio = _getMaxRatio();

        if (currentRatio > maxRatio) {
            currentRatio = maxRatio;
        }

        return IDolomiteStructs.MonetaryPrice({
            value: currentRatio
        });
    }

    function _ownerSetCapParameters(SetCapParameters memory _params) internal {
        Require.that(
            _params.snapshotRatio != 0,
            _FILE,
            "Snapshot ratio cannot be 0"
        );
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