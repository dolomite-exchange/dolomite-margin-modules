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
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IPendleRegistry } from "./interfaces/IPendleRegistry.sol";
import { PendlePtPriceOracle } from "./PendlePtPriceOracle.sol";


/**
 * @title   PendlePtRsEthPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Pendle's pt price in USD terms.
 */
contract PendlePtRsEthPriceOracle is PendlePtPriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PendlePtRsEthPriceOracle";

    // ============================ Constructor ============================

    constructor(
        address _dptToken,
        address _pendleRegistry,
        address _underlyingToken,
        address _dolomiteMargin
    ) PendlePtPriceOracle(_dptToken, _pendleRegistry, _underlyingToken, _dolomiteMargin) {}

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view override returns (uint256) {
        uint256 underlyingPrice = DOLOMITE_MARGIN.getMarketPrice(DOLOMITE_MARGIN.getMarketIdByTokenAddress(UNDERLYING_TOKEN)).value;
        uint256 ptExchangeRate = REGISTRY.ptOracle().getPtToAssetRate(address(REGISTRY.ptMarket()), TWAP_DURATION);
        return underlyingPrice * ptExchangeRate / PT_ASSET_SCALE;
    }
}
