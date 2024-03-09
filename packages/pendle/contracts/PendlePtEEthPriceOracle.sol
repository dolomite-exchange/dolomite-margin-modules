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
import { PendlePtPriceOracle } from "./PendlePtPriceOracle.sol";


/**
 * @title   PendlePtEEthPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Pendle's pt price in USD terms.
 */
contract PendlePtEEthPriceOracle is PendlePtPriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PendlePtEEthPriceOracle";
    uint256 public constant WE_ETH_ASSET_SCALE = 1 ether;

    // ============================ Constructor ============================

    constructor(
        address _dptToken,
        address _pendleRegistry,
        address _underlyingToken,
        address _dolomiteMargin
    ) PendlePtPriceOracle(_dptToken, _pendleRegistry, _underlyingToken, _dolomiteMargin) {}

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view override returns (uint256) {
        // PT-weEth -> eEth
        uint256 ptExchangeRate = REGISTRY.ptOracle().getPtToAssetRate(address(REGISTRY.ptMarket()), TWAP_DURATION);
        // eEth -> weEth
        uint256 weETHExchangeRate = REGISTRY.dolomiteRegistry().chainlinkPriceOracle().getPrice(UNDERLYING_TOKEN).value;
        // weEth -> USD
        uint256 underlyingPrice = REGISTRY.dolomiteRegistry().redstonePriceOracle().getPrice(UNDERLYING_TOKEN).value;

        return _applyDeductionCoefficient(
            underlyingPrice * ptExchangeRate * WE_ETH_ASSET_SCALE / (PT_ASSET_SCALE * weETHExchangeRate)
        );
    }
}
