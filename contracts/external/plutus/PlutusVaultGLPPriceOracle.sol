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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "../../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IPlutusVaultGLPRouter } from "../interfaces/IPlutusVaultGLPRouter.sol";


/**
 * @title   PlutusVaultGLPPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Abra's MagicGLP price in USD terms.
 */
contract PlutusVaultGLPPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PlutusVaultGLPPriceOracle";
    uint256 private constant _FEE_PRECISION = 10_000;

    // ============================ Public State Variables ============================

    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    IERC4626 immutable public PLUTUS_VAULT_GLP; // solhint-disable-line var-name-mixedcase
    uint256 immutable public DFS_GLP_MARKET_ID; // solhint-disable-line var-name-mixedcase
    IPlutusVaultGLPRouter immutable public PLV_GLP_ROUTER; // solhint-disable-line var-name-mixedcase
    address immutable public PLUTUS_VAULT_GLP_UNWRAPPER_TRADER; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _plutusVaultGlp,
        uint256 _dfsGlpMarketId,
        address _plvGlpRouter,
        address _plutusVaultGlpUnwrapperTrader
    ) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        PLUTUS_VAULT_GLP = IERC4626(_plutusVaultGlp);
        DFS_GLP_MARKET_ID = _dfsGlpMarketId;
        PLV_GLP_ROUTER = _plvGlpRouter;
        PLUTUS_VAULT_GLP_UNWRAPPER_TRADER = _plutusVaultGlpUnwrapperTrader;
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == address(PLUTUS_VAULT_GLP),
            _FILE,
            "invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "plvGLP cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 glpPrice = DOLOMITE_MARGIN.getMarketPrice(DFS_GLP_MARKET_ID).value;
        uint256 totalSupply = PLUTUS_VAULT_GLP.totalSupply();
        uint256 glpPriceWithExchangeRate;
        if (totalSupply == 0) {
            // exchange rate is 1 if the total supply is 0
            glpPriceWithExchangeRate = glpPrice;
        } else {
            glpPriceWithExchangeRate = glpPrice * PLUTUS_VAULT_GLP.totalAssets() / totalSupply;
        }

        (uint256 exitFeeBp,) = PLV_GLP_ROUTER.getFeeBp(PLUTUS_VAULT_GLP_UNWRAPPER_TRADER);
        uint256 exitFee = glpPriceWithExchangeRate * exitFeeBp / _FEE_PRECISION;

        return glpPriceWithExchangeRate - exitFee;
    }
}
