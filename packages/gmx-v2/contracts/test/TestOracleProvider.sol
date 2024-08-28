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

import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";


/**
 * @title   TestOracleProvider
 * @author  Dolomite
 *
 * @notice  Test oracle provider to be used with GMX V2 tests
 */
contract TestOracleProvider {

    bytes32 private constant _FILE = "TestOracleProvider";
    IDolomiteMargin public immutable DOLOMITE_MARGIN;

    struct ValidatedPrice {
        address token;
        uint256 min;
        uint256 max;
        uint256 timestamp;
        address provider;
    }

    constructor(address _dolomiteMargin) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function getOraclePrice(address _token, bytes memory _data) external returns (ValidatedPrice memory) {
        uint256 price = DOLOMITE_MARGIN.getMarketPrice(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)).value;
        price = price / 10 ** 6;

        return ValidatedPrice({
            token: _token,
            min: price,
            max: price,
            timestamp: block.timestamp,
            provider: address(this)
        });
    }
}
