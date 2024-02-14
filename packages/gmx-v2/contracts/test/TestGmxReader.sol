// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;

import { IGmxDataStore } from "../interfaces/IGmxDataStore.sol";
import { IGmxReader } from "../interfaces/IGmxReader.sol";
import { GmxDeposit } from "../lib/GmxDeposit.sol";
import { GmxMarket } from "../lib/GmxMarket.sol";
import { GmxMarketPoolValueInfo } from "../lib/GmxMarketPoolValueInfo.sol";
import { GmxPrice } from "../lib/GmxPrice.sol";
import { GmxWithdrawal } from "../lib/GmxWithdrawal.sol";


/**
 * @title   TestGmxReader
 * @author  Dolomite
 *
 * @notice  Test implementation for exposing areas for coverage testing
 */
contract TestGmxReader is IGmxReader {

    bytes32 private constant _FILE = "TestGmxReader";

    int256 public shortPnlToPoolFactor;
    int256 public longPnlToPoolFactor;
    int256 public marketPrice;

    function setPnlToPoolFactors(int256 _shortPnlToPoolFactor, int256 _longPnlToPoolFactor) external {
        shortPnlToPoolFactor = _shortPnlToPoolFactor;
        longPnlToPoolFactor = _longPnlToPoolFactor;
    }

    function setMarketPrice(int256 _marketPrice) external {
        marketPrice = _marketPrice;
    }

    function getPnlToPoolFactor(
        IGmxDataStore /* dataStore */,
        address /* marketAddress */,
        GmxMarket.MarketPrices memory /* prices */,
        bool isLong,
        bool /* maximize */
    ) external view returns (int256) {
        return isLong ? longPnlToPoolFactor : shortPnlToPoolFactor;
    }

    function getMarketTokenPrice(
        IGmxDataStore /* _dataStore */,
        GmxMarket.MarketProps memory /* _market */,
        GmxPrice.PriceProps memory /* _indexTokenPrice */,
        GmxPrice.PriceProps memory /* _longTokenPrice */,
        GmxPrice.PriceProps memory /* _shortTokenPrice */,
        bytes32 /* _pnlFactorType */,
        bool /* _maximize */
    ) external view returns (int256, GmxMarketPoolValueInfo.PoolValueInfoProps memory) {
        GmxMarketPoolValueInfo.PoolValueInfoProps memory props = GmxMarketPoolValueInfo.PoolValueInfoProps({
            poolValue: 0,
            longPnl: 0,
            shortPnl: 0,
            netPnl: 0,
            longTokenAmount: 0,
            shortTokenAmount: 0,
            longTokenUsd: 0,
            shortTokenUsd: 0,
            totalBorrowingFees: 0,
            borrowingFeePoolFactor: 0,
            impactPoolAmount: 0
        });

        return (marketPrice, props);
    }

    function getDeposit(
        IGmxDataStore /* _dataStore */,
        bytes32 /* _key */
    ) external pure returns (GmxDeposit.DepositProps memory props) {
        return props;
    }

    function getWithdrawal(
        IGmxDataStore /* _dataStore */,
        bytes32 /* _key */
    ) external pure returns (GmxWithdrawal.WithdrawalProps memory props) {
        return props;
    }

    function getSwapPriceImpact(
        IGmxDataStore /* _dataStore */,
        address /* _marketKey */,
        address /* _tokenIn */,
        address /* _tokenOut */,
        uint256 /* _amountIn */,
        GmxPrice.PriceProps memory /* _tokenInPrice */,
        GmxPrice.PriceProps memory /* _tokenOutPrice */
    ) external pure returns (int256, int256) {
        return (0, 0);
    }
}
