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

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { GmxMarket } from "../interfaces/gmx/GmxMarket.sol";
import { GmxPrice } from "../interfaces/gmx/GmxPrice.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2MarketTokenPriceOracle } from "../interfaces/gmx/IGmxV2MarketTokenPriceOracle.sol";


/**
 * @title   GmxV2MarketTokenPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets GMX's V2 Market token price in USD
 */
contract GmxV2MarketTokenPriceOracle is IGmxV2MarketTokenPriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GmxV2MarketTokenPriceOracle";
    uint256 public constant ETH_USD_PRECISION = 1e18;
    uint256 public constant FEE_PRECISION = 10_000;
    uint256 public constant GMX_DECIMAL_ADJUSTMENT = 6;
    uint256 public constant RETURN_DECIMAL_ADJUSTMENT = 12;

    bytes32 public constant MAX_PNL_FACTOR_FOR_WITHDRAWALS = keccak256(abi.encode("MAX_PNL_FACTOR_FOR_WITHDRAWALS"));

    // ============================ Public State Variables ============================

    IGmxRegistryV2 public immutable REGISTRY; // solhint-disable-line var-name-mixedcase

    mapping(address => bool) public marketTokens;

    // ============================ Constructor ============================

    constructor(
        address _gmxRegistryV2,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        REGISTRY = IGmxRegistryV2(_gmxRegistryV2);
    }

    function ownerSetMarketToken(
        address _token,
        bool _status
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetMarketToken(_token, _status);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            marketTokens[_token],
            _FILE,
            "Invalid token",
            _token
        );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        Require.that(
            dolomiteMargin.getMarketIsClosing(dolomiteMargin.getMarketIdByTokenAddress(_token)),
            _FILE,
            "gmToken cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice(_token)
        });
    }

    // ============================ Internal Functions ============================

    function _ownerSetMarketToken(address _token, bool _status) internal {
        Require.that(
            IERC20Metadata(_token).decimals() == 18,
            _FILE,
            "Invalid market token decimals"
        );
        marketTokens[_token] = _status;
        emit MarketTokenSet(_token, _status);
    }

    function _getCurrentPrice(address _token) internal view returns (uint256) {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(_token);

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        uint256 indexTokenPrice = dolomiteMargin.getMarketPrice(factory.INDEX_TOKEN_MARKET_ID()).value;
        uint256 shortTokenPrice = dolomiteMargin.getMarketPrice(factory.SHORT_TOKEN_MARKET_ID()).value;
        uint256 longTokenPrice = dolomiteMargin.getMarketPrice(factory.LONG_TOKEN_MARKET_ID()).value;

        GmxMarket.MarketProps memory marketProps = GmxMarket.MarketProps({
            marketToken: factory.UNDERLYING_TOKEN(),
            indexToken: factory.INDEX_TOKEN(),
            longToken: factory.LONG_TOKEN(),
            shortToken: factory.SHORT_TOKEN()
        });

       // Dolomite returns price as 36 decimals - token decimals
       // GMX expects 30 decimals - token decimals so we divide by 10 ** 6
        GmxPrice.PriceProps memory indexTokenPriceProps = GmxPrice.PriceProps(
            indexTokenPrice / 10 ** GMX_DECIMAL_ADJUSTMENT,
            indexTokenPrice / 10 ** GMX_DECIMAL_ADJUSTMENT
        );

        GmxPrice.PriceProps memory longTokenPriceProps = GmxPrice.PriceProps(
            longTokenPrice / 10 ** GMX_DECIMAL_ADJUSTMENT,
            longTokenPrice / 10 ** GMX_DECIMAL_ADJUSTMENT
        );

        GmxPrice.PriceProps memory shortTokenPriceProps = GmxPrice.PriceProps(
            shortTokenPrice / 10 ** GMX_DECIMAL_ADJUSTMENT,
            shortTokenPrice / 10 ** GMX_DECIMAL_ADJUSTMENT
        );
       // @audit Are we worried about this precision loss?

        (int256 value, ) = REGISTRY.gmxReader().getMarketTokenPrice(
            REGISTRY.gmxDataStore(),
            marketProps,
            indexTokenPriceProps,
            longTokenPriceProps,
            shortTokenPriceProps,
            MAX_PNL_FACTOR_FOR_WITHDRAWALS,
            true
        );

        // @audit Is there a better way to handle this? When could the reader return negative here?
        Require.that(
            value > 0,
            _FILE,
            "Invalid oracle response"
        );

        // GMX returns the price in 30 decimals. We convert to 18 decimals (36 - GM token decimals)
        return uint256(value) / 10 ** RETURN_DECIMAL_ADJUSTMENT;
    }
}
