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

import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IIsolationModeVaultFactory } from "../interfaces/IIsolationModeVaultFactory.sol";
import { IUmamiAssetVault } from "../interfaces/umami/IUmamiAssetVault.sol";
import { IUmamiAssetVaultRegistry } from "../interfaces/umami/IUmamiAssetVaultRegistry.sol";
import { ChainlinkAutomationPriceOracle } from "../oracles/ChainlinkAutomationPriceOracle.sol";


/**
 * @title   UmamiAssetVaultWithChainlinkAutomationPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the ChainlinkAutomationPriceOracle that gets Umami asset vault price in USD terms
 * @notice  Uses Chainlink automation
 */
contract UmamiAssetVaultWithChainlinkAutomationPriceOracle is ChainlinkAutomationPriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "UmamiAssetWithChainlinkOracle";
    uint256 public constant FEE_PRECISION = 100 * (10 ** 18);

    // ============================ Public State Variables ============================

    IUmamiAssetVaultRegistry immutable public UMAMI_ASSET_VAULT_REGISTRY; // solhint-disable-line var-name-mixedcase
    IIsolationModeVaultFactory immutable public ISOLATION_MODE_TOKEN; // solhint-disable-line var-name-mixedcase
    uint256 immutable public UNDERLYING_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _chainlinkRegistry,
        address _umamiAssetVaultRegistry,
        address _isolationModeVaultToken
    ) ChainlinkAutomationPriceOracle(_dolomiteMargin, _chainlinkRegistry) {
        UMAMI_ASSET_VAULT_REGISTRY = IUmamiAssetVaultRegistry(_umamiAssetVaultRegistry);
        ISOLATION_MODE_TOKEN = IIsolationModeVaultFactory(_isolationModeVaultToken);
        UNDERLYING_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(
            IUmamiAssetVault(ISOLATION_MODE_TOKEN.UNDERLYING_TOKEN()).asset()
        );

        _updateExchangeRateAndTimestamp();
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(ISOLATION_MODE_TOKEN),
            _FILE,
            "Invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "Umami Asset cannot be borrowable"
        );

        _checkIsPriceExpired();

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getExchangeRate() internal view override returns (uint256, uint256) {
        IUmamiAssetVault vaultToken = IUmamiAssetVault(ISOLATION_MODE_TOKEN.UNDERLYING_TOKEN());
        return (vaultToken.totalAssets(), vaultToken.totalSupply());
    }

    function _getCurrentPrice() internal view override returns (uint256) {
        uint256 underlyingPrice = DOLOMITE_MARGIN().getMarketPrice(UNDERLYING_MARKET_ID).value;
        uint256 price = exchangeRateDenominator == 0
            ? underlyingPrice
            : underlyingPrice * exchangeRateNumerator / exchangeRateDenominator;
        uint256 withdrawalFee = UMAMI_ASSET_VAULT_REGISTRY.storageViewer().getVaultFees().withdrawalFee;
        return price - (price * withdrawalFee / FEE_PRECISION);
    }
}
