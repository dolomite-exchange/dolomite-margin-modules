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
import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";

import "hardhat/console.sol";

/**
 * @title   GmxV2MarketTokenPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets GMX's V2 Market token price in USD
 */
contract GmxV2MarketTokenPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GmxV2MarketTokenPriceOracle";
    uint256 public constant ETH_USD_PRECISION = 1e18;
    uint256 public constant FEE_PRECISION = 10_000;

    // ============================ Public State Variables ============================

    // @note Revisit naming conventions
    address public immutable DGM_ETH_USD; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV2 public immutable REGISTRY; // solhint-disable-line var-name-mixedcase
    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dGmEthUsd,
        address _gmxRegistryV2,
        address _dolomiteMargin
    ) {
        DGM_ETH_USD = _dGmEthUsd;
        REGISTRY = IGmxRegistryV2(_gmxRegistryV2);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(DGM_ETH_USD),
            _FILE,
            "Invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "gmEthUsd cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    // @note Look at stuff GMX sent
    function _getCurrentPrice() internal view returns (uint256) {
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(DGM_ETH_USD);

        console.log(factory.indexToken());
        return 1;
    }
}
