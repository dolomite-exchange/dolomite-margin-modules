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

import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol"; // solhint-disable-line max-line-length

import "hardhat/console.sol";

/**
 * @title   TestOracleProvider
 * @author  Dolomite
 *
 * @notice  Test oracle provider to be used with GMX V2 tests
 */
contract TestOracleProvider {

    bytes32 private constant _FILE = "TestOracleProvider";
    IDolomitePriceOracle public immutable ORACLE_AGGREGATOR;
    uint256 public constant GMX_DECIMAL_ADJUSTMENT = 10 ** 6;

    struct ValidatedPrice {
        address token;
        uint256 min;
        uint256 max;
        uint256 timestamp;
        address provider;
    }

    constructor(address _oracleAggregator) {
        ORACLE_AGGREGATOR = IDolomitePriceOracle(_oracleAggregator);
    }

    function getOraclePrice(address _token, bytes memory /* _data */) external view returns (ValidatedPrice memory) {
        try ORACLE_AGGREGATOR.getPrice(_token) returns (IDolomiteStructs.MonetaryPrice memory price) {
            uint256 priceUint = price.value / GMX_DECIMAL_ADJUSTMENT;

            return ValidatedPrice({
                token: _token,
                min: priceUint,
                max: priceUint,
                timestamp: block.timestamp,
                provider: address(this)
            });
        } catch {
            // Should only be here for SHIB
            uint256 price = 13937067;
            return ValidatedPrice({
                token: _token,
                min: price,
                max: price,
                timestamp: block.timestamp,
                provider: address(this)
            });
        }
    }
}
