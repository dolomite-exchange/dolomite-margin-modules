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
import { IPlutusVaultRegistry } from "../interfaces/plutus/IPlutusVaultRegistry.sol";



/**
 * @title   PlutusVaultGLPPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Plutus' plvGLP price in USD terms.
 */
contract PlutusVaultGLPPriceOracle is IDolomitePriceOracle {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "PlutusVaultGLPPriceOracle";
    uint256 private constant _FEE_PRECISION = 10_000;

    // ============================ Public State Variables ============================

    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    uint256 immutable public DFS_GLP_MARKET_ID; // solhint-disable-line var-name-mixedcase
    address immutable public DPLV_GLP; // solhint-disable-line var-name-mixedcase
    IPlutusVaultRegistry immutable public PLUTUS_VAULT_REGISTRY; // solhint-disable-line var-name-mixedcase
    address immutable public PLUTUS_VAULT_GLP_UNWRAPPER_TRADER; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        uint256 _dfsGlpMarketId,
        address _dplvGlp,
        address _plutusVaultRegistry,
        address _plutusVaultGLPUnwrapperTrader
    ) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        DFS_GLP_MARKET_ID = _dfsGlpMarketId;
        DPLV_GLP = _dplvGlp;
        PLUTUS_VAULT_REGISTRY = IPlutusVaultRegistry(_plutusVaultRegistry);
        PLUTUS_VAULT_GLP_UNWRAPPER_TRADER = _plutusVaultGLPUnwrapperTrader;
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == DPLV_GLP,
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
        IERC4626 plvGlp = PLUTUS_VAULT_REGISTRY.plvGlpToken();
        uint256 totalSupply = plvGlp.totalSupply();
        uint256 glpPriceWithExchangeRate;
        if (totalSupply == 0) {
            // exchange rate is 1 if the total supply is 0
            glpPriceWithExchangeRate = glpPrice;
        } else {
            glpPriceWithExchangeRate = glpPrice * plvGlp.totalAssets() / totalSupply;
        }

        (uint256 exitFeeBp,) = PLUTUS_VAULT_REGISTRY.plvGlpRouter().getFeeBp(PLUTUS_VAULT_GLP_UNWRAPPER_TRADER);
        uint256 exitFee = glpPriceWithExchangeRate * exitFeeBp / _FEE_PRECISION;

        return glpPriceWithExchangeRate - exitFee;
    }
}
