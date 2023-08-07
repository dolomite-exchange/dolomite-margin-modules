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

import "../external/general/DolomitePriceOracleChainlink.sol";

/**
 * @title   TestDolomitePriceOracleChainlink
 * @author  Dolomite
 *
 * @notice  This contract is used to test the DolomitePriceOracleChainlink contract.
 */
contract TestDolomitePriceOracleChainlink is DolomitePriceOracleChainlink {

    constructor(address _dolomiteMargin, address _chainlinkRegistry) DolomitePriceOracleChainlink(_dolomiteMargin, _chainlinkRegistry) {}

    function checkUpkeep(bytes calldata checkData) external override returns (bool upkeepNeeded, bytes memory /* performData */) {
        return (true, '0x');
    }

    function performUpkeep(bytes calldata performData) external override {}

    function getPrice(address token) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        return IDolomiteStructs.MonetaryPrice({
            value: 0
        });
    }

    function _checkUpkeepConditions() internal override view returns (bool) {
        return true;
    }

    function _getCurrentPrice() internal override view returns (uint256) {
        return 0;
    }
}
