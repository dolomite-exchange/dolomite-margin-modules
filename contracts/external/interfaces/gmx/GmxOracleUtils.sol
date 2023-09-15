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

import { GmxPrice } from "./GmxPrice.sol";


/**
 * @title   GmxOracleUtils
 * @author  Dolomite
 *
 */
library GmxOracleUtils {

    // @dev SetPricesParams struct for values required in Oracle.setPrices
    // @param signerInfo compacted indexes of signers, the index is used to retrieve
    // the signer address from the OracleStore
    // @param tokens list of tokens to set prices for
    // @param compactedOracleBlockNumbers compacted oracle block numbers
    // @param compactedOracleTimestamps compacted oracle timestamps
    // @param compactedDecimals compacted decimals for prices
    // @param compactedMinPrices compacted min prices
    // @param compactedMinPricesIndexes compacted min price indexes
    // @param compactedMaxPrices compacted max prices
    // @param compactedMaxPricesIndexes compacted max price indexes
    // @param signatures signatures of the oracle signers
    // @param priceFeedTokens tokens to set prices for based on an external price feed value
    struct SetPricesParams {
        uint256 signerInfo;
        address[] tokens;
        uint256[] compactedMinOracleBlockNumbers;
        uint256[] compactedMaxOracleBlockNumbers;
        uint256[] compactedOracleTimestamps;
        uint256[] compactedDecimals;
        uint256[] compactedMinPrices;
        uint256[] compactedMinPricesIndexes;
        uint256[] compactedMaxPrices;
        uint256[] compactedMaxPricesIndexes;
        bytes[] signatures;
        address[] priceFeedTokens;
    }

    struct SimulatePricesParams {
        address[] primaryTokens;
        GmxPrice.Props[] primaryPrices;
    }
}