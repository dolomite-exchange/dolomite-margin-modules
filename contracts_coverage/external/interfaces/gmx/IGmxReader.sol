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


import { GmxDeposit } from "./GmxDeposit.sol";
import { GmxMarket } from "./GmxMarket.sol";
import { GmxMarketPoolValueInfo } from "./GmxMarketPoolValueInfo.sol";
import { GmxPrice } from "./GmxPrice.sol";
import { GmxWithdrawal } from "./GmxWithdrawal.sol";
import { IGmxDataStore } from "./IGmxDataStore.sol";


/**
 * @title   IGmxReader
 * @author  Dolomite
 *
 * @notice  GMX Reader Interface
 */
interface IGmxReader {

    function getMarketTokenPrice(
        IGmxDataStore _dataStore,
        GmxMarket.MarketProps memory _market,
        GmxPrice.PriceProps memory _indexTokenPrice,
        GmxPrice.PriceProps memory _longTokenPrice,
        GmxPrice.PriceProps memory _shortTokenPrice,
        bytes32 _pnlFactorType,
        bool _maximize
    )
        external
        view
        returns (int256, GmxMarketPoolValueInfo.PoolValueInfoProps memory);

    function getDeposit(
        IGmxDataStore dataStore,
        bytes32 key
    )
        external
        view
        returns (GmxDeposit.DepositProps memory);

    function getWithdrawal(
        IGmxDataStore dataStore,
        bytes32 key
    )
        external
        view
        returns (GmxWithdrawal.WithdrawalProps memory);
}
