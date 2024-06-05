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
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { ChainlinkAutomationPriceOracle } from "@dolomite-exchange/modules-oracles/contracts/ChainlinkAutomationPriceOracle.sol"; // solhint-disable-line max-line-length
import { JonesUSDCMathLib } from "./JonesUSDCMathLib.sol";
import { IJonesUSDCRegistry } from "./interfaces/IJonesUSDCRegistry.sol";


/**
 * @title   JonesUSDCWithChainlinkAutomationPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of ChainlinkAutomationPriceOracle that gets Jones DAO's jUSDC price in USD terms
 * @notice  Uses Chainlink automation
 */
contract JonesUSDCWithChainlinkAutomationPriceOracle is ChainlinkAutomationPriceOracle {
    using JonesUSDCMathLib for IJonesUSDCRegistry;

    // ============================ Constants ============================

    bytes32 private constant _FILE = "jUSDCWithChainlinkPriceOracle";
    uint256 private constant _USDC_DECIMALS_DIFF = 12;
    uint256 private constant _USDC_SCALE_DIFF = 10 ** _USDC_DECIMALS_DIFF;

    // ============================ Public State Variables ============================

    IJonesUSDCRegistry immutable public JONES_USDC_REGISTRY; // solhint-disable-line var-name-mixedcase
    uint256 immutable public USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    address immutable public DJUSDC; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================
    constructor(
        address _dolomiteMargin,
        address _chainlinkRegistry,
        address _jonesUSDCRegistry,
        uint256 _usdcMarketId,
        address _djUSDC
    ) ChainlinkAutomationPriceOracle(_dolomiteMargin, _chainlinkRegistry) {
        JONES_USDC_REGISTRY = IJonesUSDCRegistry(_jonesUSDCRegistry);
        USDC_MARKET_ID = _usdcMarketId;
        DJUSDC = _djUSDC;

        _updateExchangeRateAndTimestamp();
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
        Require.that(
            _token == DJUSDC,
            _FILE,
            "Invalid token",
            _token
        );
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "jUSDC cannot be borrowable"
        );

        _checkIsPriceExpired();

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getExchangeRate() internal view override returns (uint256, uint256) {
        IERC4626 jUSDC = JONES_USDC_REGISTRY.jUSDC();
        return (jUSDC.totalAssets(), jUSDC.totalSupply());
    }

    function _getCurrentPrice() internal view override returns (uint256) {
        uint256 usdcPrice = DOLOMITE_MARGIN().getMarketPrice(USDC_MARKET_ID).value / _USDC_SCALE_DIFF;
        uint256 price = exchangeRateDenominator == 0
            ? usdcPrice
            : usdcPrice * exchangeRateNumerator / exchangeRateDenominator;
        (uint256 retentionFee, uint256 retentionFeeBase) = JONES_USDC_REGISTRY.getRetentionFee(
            JONES_USDC_REGISTRY.unwrapperTraderForLiquidation()
        );
        return price - (price * retentionFee / retentionFeeBase);
    }
}
