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

import { GLPMathLib } from "./GLPMathLib.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";
import { WrappedTokenUserVaultUnwrapperTrader } from "../proxies/abstract/WrappedTokenUserVaultUnwrapperTrader.sol";


/**
 * @title   GLPUnwrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GLP (via burning via the GLPRewardsRouter) into USDC. Upon settlement, the burned GLP is
 *          sent from the user's vault to this contract and dfsGLP is burned from `DolomiteMargin`.
 */
contract GLPUnwrapperTraderV1 is WrappedTokenUserVaultUnwrapperTrader {
    using GLPMathLib for IGmxVault;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPUnwrapperTraderV1";

    // ============ Immutable State Variables ============

    address public immutable USDC; // solhint-disable-line var-name-mixedcase
    uint256 public immutable USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _gmxRegistry,
        address _dfsGlp,
        address _dolomiteMargin
    )
    WrappedTokenUserVaultUnwrapperTrader(_dfsGlp, _dolomiteMargin) {
        USDC = _usdc;
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);

        USDC_MARKET_ID = IDolomiteMargin(_dolomiteMargin).getMarketIdByTokenAddress(_usdc);
    }

    // ============================================
    // ============ External Functions ============
    // ============================================

    function outputMarketId() public override view returns (uint256) {
        return USDC_MARKET_ID;
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function getExchangeCost(
        address _makerToken,
        address _takerToken,
        uint256 _desiredMakerToken,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        if (_makerToken == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(_makerToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid maker token",
            _makerToken
        );
        if (_takerToken == USDC) { /* FOR COVERAGE TESTING */ }
        Require.that(_takerToken == USDC,
            _FILE,
            "Invalid taker token",
            _takerToken
        );

        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, _desiredMakerToken);

        return GMX_REGISTRY.gmxVault().getGlpRedemptionAmount(_takerToken, usdgAmount);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _makerToken,
        uint256 _minMakerAmount,
        address,
        uint256 _amountTakerToken,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        if (_makerToken == USDC) { /* FOR COVERAGE TESTING */ }
        Require.that(_makerToken == USDC,
            _FILE,
            "Invalid maker token",
            _makerToken
        );

        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _makerToken,
            /* _glpAmount = */ _amountTakerToken,
            _minMakerAmount,
            /* _receiver = */ address(this)
        );

        return amountOut;
    }
}
