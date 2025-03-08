// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteERC4626.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";


/**
 * @title   POLPriceOracleV2
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that returns the supply rate of the POL token.
 *          This must be used with the oracle aggregator
 */
contract POLPriceOracleV2 is IDolomitePriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "POLPriceOracleV2";

    // ============================ Public State Variables ============================

    address immutable public DPOL_TOKEN; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dPolToken,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DPOL_TOKEN = _dPolToken;
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        if (_token == address(DPOL_TOKEN)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _token == address(DPOL_TOKEN),
            _FILE,
            "invalid token",
            _token
        );
        // @follow-up Do we still want this check?
        if (DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN().getMarketIsClosing(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)),
            _FILE,
            "POL cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    function getDecimalsByToken(address _token) external view returns (uint8) {
        return IERC20Metadata(_token).decimals();
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view virtual returns (uint256) {
        IIsolationModeVaultFactory factory = IIsolationModeVaultFactory(DPOL_TOKEN);
        uint256 marketId = IDolomiteERC4626(factory.UNDERLYING_TOKEN()).marketId();

        return DOLOMITE_MARGIN().getMarketCurrentIndex(marketId).supply;
    }
}
