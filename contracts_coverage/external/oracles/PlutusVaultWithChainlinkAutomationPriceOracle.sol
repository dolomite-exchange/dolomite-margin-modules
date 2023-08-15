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


import { ChainlinkAutomationPriceOracle } from "./ChainlinkAutomationPriceOracle.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IPlutusVaultRegistry } from "../interfaces/plutus/IPlutusVaultRegistry.sol";

import { Require } from "../../protocol/lib/Require.sol";

/**
 * @title   PlutusVaultWithChainlinkAutomationPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the ChainlinkAutomationPriceOracle that gets Plutus' plvGLP price in USD terms.
 * @notice  Uses Chainlink automation
 */
contract PlutusVaultWithChainlinkAutomationPriceOracle is ChainlinkAutomationPriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PlvWithChainlinkPriceOracle";
    uint256 private constant _FEE_PRECISION = 10_000;

    // ============================ Public State Variables ============================

    uint256 immutable public DFS_GLP_MARKET_ID; // solhint-disable-line var-name-mixedcase
    address immutable public DPLV_GLP; // solhint-disable-line var-name-mixedcase
    IPlutusVaultRegistry immutable public PLUTUS_VAULT_REGISTRY; // solhint-disable-line var-name-mixedcase
    address immutable public PLUTUS_VAULT_GLP_UNWRAPPER_TRADER; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _chainlinkRegistry,
        uint256 _dfsGlpMarketId,
        address _dplvGlp,
        address _plutusVaultRegistry,
        address _plutusVaultGLPUnwrapperTrader
    ) ChainlinkAutomationPriceOracle(_dolomiteMargin, _chainlinkRegistry) {
        DFS_GLP_MARKET_ID = _dfsGlpMarketId;
        DPLV_GLP = _dplvGlp;
        PLUTUS_VAULT_REGISTRY = IPlutusVaultRegistry(_plutusVaultRegistry);
        PLUTUS_VAULT_GLP_UNWRAPPER_TRADER = _plutusVaultGLPUnwrapperTrader;

        _updateExchangeRateAndTimestamp();
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_token == DPLV_GLP) { /* FOR COVERAGE TESTING */ }
        Require.that(_token == DPLV_GLP,
            _FILE,
            "Invalid token",
            _token
        );
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "plvGLP cannot be borrowable"
        );

        _checkIsPriceExpired();

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getExchangeRate() internal view override returns (uint256, uint256) {
        IERC4626 plvGlp = PLUTUS_VAULT_REGISTRY.plvGlpToken();
        return (plvGlp.totalAssets(), plvGlp.totalSupply());
    }

    function _getCurrentPrice() internal view override returns (uint256) {
        uint256 glpPrice = DOLOMITE_MARGIN().getMarketPrice(DFS_GLP_MARKET_ID).value;
        uint256 glpPriceWithExchangeRate;
        if (exchangeRateDenominator == 0) {
            // exchange rate is 1 if the total supply is 0
            glpPriceWithExchangeRate = glpPrice;
        } else {
            glpPriceWithExchangeRate = glpPrice * exchangeRateNumerator / exchangeRateDenominator;
        }
        (uint256 exitFeeBp,) = PLUTUS_VAULT_REGISTRY.plvGlpRouter().getFeeBp(PLUTUS_VAULT_GLP_UNWRAPPER_TRADER);
        uint256 exitFee = glpPriceWithExchangeRate * exitFeeBp / _FEE_PRECISION;

        return glpPriceWithExchangeRate - exitFee;
    }
}
