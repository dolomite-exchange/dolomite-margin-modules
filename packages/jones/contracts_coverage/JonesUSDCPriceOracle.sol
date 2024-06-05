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

import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { JonesUSDCMathLib } from "./JonesUSDCMathLib.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";


/**
 * @title   JonesUSDCPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Jones DAO's jUSDC price in USD terms.
 */
contract JonesUSDCPriceOracle is IDolomitePriceOracle {
    using JonesUSDCMathLib for IJonesUSDCRegistry;

    // ============================ Constants ============================

    bytes32 private constant _FILE = "JonesUSDCPriceOracle";
    uint256 private constant _USDC_DECIMALS_DIFF = 12;
    uint256 private constant _USDC_SCALE_DIFF = 10 ** _USDC_DECIMALS_DIFF;

    // ============================ Public State Variables ============================

    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    IJonesUSDCRegistry immutable public JONES_USDC_REGISTRY; // solhint-disable-line var-name-mixedcase
    uint256 immutable public USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    address immutable public DJUSDC; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _jonesUSDCRegistry,
        uint256 _usdcMarketId,
        address djUSDC
    ) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        JONES_USDC_REGISTRY = IJonesUSDCRegistry(_jonesUSDCRegistry);
        USDC_MARKET_ID = _usdcMarketId;
        DJUSDC = djUSDC;
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        if (_token == DJUSDC) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _token == DJUSDC,
            _FILE,
            "Invalid token",
            _token
        );
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "jUSDC cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 usdcPrice = DOLOMITE_MARGIN.getMarketPrice(USDC_MARKET_ID).value / _USDC_SCALE_DIFF;
        IERC4626 jUSDC = JONES_USDC_REGISTRY.jUSDC();
        uint256 totalSupply = jUSDC.totalSupply();
        uint256 price = totalSupply == 0
                ? usdcPrice
                : usdcPrice * jUSDC.totalAssets() / totalSupply;
        (uint256 retentionFee, uint256 retentionFeeBase) = JONES_USDC_REGISTRY.getRetentionFee(
            JONES_USDC_REGISTRY.unwrapperTraderForLiquidation()
        );
        return price - (price * retentionFee / retentionFeeBase);
    }
}
