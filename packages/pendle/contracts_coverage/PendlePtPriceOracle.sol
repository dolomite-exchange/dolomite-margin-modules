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




/**
 * @title   PendlePtPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Pendle's pt price in USD terms.
 */
contract PendlePtPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PendlePtPriceOracle";
    uint32 public constant TWAP_DURATION = 900; // 15 minutes

    // ============================ Public State Variables ============================

    address immutable public DPT_TOKEN; // solhint-disable-line var-name-mixedcase
    IPendleRegistry immutable public REGISTRY; // solhint-disable-line var-name-mixedcase
    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    address immutable public UNDERLYING_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 immutable public PT_ASSET_SCALE; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dptToken,
        address _pendleRegistry,
        address _underlyingToken,
        address _dolomiteMargin
    ) {
        DPT_TOKEN = _dptToken;
        REGISTRY = IPendleRegistry(_pendleRegistry);
        UNDERLYING_TOKEN = _underlyingToken;
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        PT_ASSET_SCALE = uint256(10) ** uint256(IERC20Metadata(DPT_TOKEN).decimals());

        (
            bool increaseCardinalityRequired,,
            bool oldestObservationSatisfied
        ) = REGISTRY.ptOracle().getOracleState(address(REGISTRY.ptMarket()), TWAP_DURATION);

        if (!increaseCardinalityRequired && oldestObservationSatisfied) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !increaseCardinalityRequired && oldestObservationSatisfied,
            _FILE,
            "Oracle not ready yet"
        );
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_token == address(DPT_TOKEN)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _token == address(DPT_TOKEN),
            _FILE,
            "invalid token",
            _token
        );
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "PT cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 underlyingPrice = REGISTRY.dolomiteRegistry().chainlinkPriceOracle().getPrice(UNDERLYING_TOKEN).value;
        uint256 ptExchangeRate = REGISTRY.ptOracle().getPtToAssetRate(address(REGISTRY.ptMarket()), TWAP_DURATION);
        return underlyingPrice * ptExchangeRate / PT_ASSET_SCALE;
    }
}
