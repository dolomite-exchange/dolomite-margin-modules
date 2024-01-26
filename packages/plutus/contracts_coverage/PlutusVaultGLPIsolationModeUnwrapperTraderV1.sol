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

import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { GLPMathLib } from "@dolomite-exchange/modules-glp/contracts/GLPMathLib.sol";
import { IGmxRegistryV1 } from "@dolomite-exchange/modules-glp/contracts/interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "@dolomite-exchange/modules-glp/contracts/interfaces/IGmxVault.sol";
import { IPlutusVaultGLPRouter } from "./interfaces/IPlutusVaultGLPRouter.sol";
import { IPlutusVaultRegistry } from "./interfaces/IPlutusVaultRegistry.sol";
import { IsolationModeUnwrapperTraderV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV1.sol";


/**
 * @title   PlutusVaultGLPIsolationModeUnwrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Used for unwrapping plvGLP (via redeeming for GLP and burning GLP via the GLPRewardsRouter) into USDC.
 *          During settlement, the redeemed plvGLP is sent from the user's vault to this contract to process the
 *          unwrapping.
 */
contract PlutusVaultGLPIsolationModeUnwrapperTraderV1 is IsolationModeUnwrapperTraderV1 {
    using GLPMathLib for IGmxVault;

    // ============ Constants ============

    bytes32 private constant _FILE = "PlutusVaultGLPUnwrapperV1";

    // ============ Immutable State Variables ============

    address public immutable USDC; // solhint-disable-line var-name-mixedcase
    uint256 public immutable USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase
    IPlutusVaultRegistry public immutable PLUTUS_VAULT_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _gmxRegistry,
        address _plutusVaultRegistry,
        address _dPlvGlp,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV1(
        _dPlvGlp,
        _dolomiteMargin
    ) {
        USDC = _usdc;
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
        PLUTUS_VAULT_REGISTRY = IPlutusVaultRegistry(_plutusVaultRegistry);

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
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        Require.that(
            _inputToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            _outputToken == USDC,
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        (,,uint256 glpAmount) = PLUTUS_VAULT_REGISTRY.plvGlpRouter().previewRedeem(address(this), _desiredInputAmount);

        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, glpAmount);

        return GMX_REGISTRY.gmxVault().getGlpRedemptionAmount(_outputToken, usdgAmount);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _outputToken,
        uint256 _minOutputAmount,
        address,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        Require.that(
            _outputToken == USDC,
            _FILE,
            "Invalid output token",
            _outputToken
        );

        IPlutusVaultGLPRouter plvGlpRouter = PLUTUS_VAULT_REGISTRY.plvGlpRouter();

        // plvGlpRouter::redeem doesn't return a value so we need call previewRedeem first
        (,, uint256 glpAmount) = plvGlpRouter.previewRedeem(address(this), _inputAmount);
        PLUTUS_VAULT_REGISTRY.plvGlpToken().approve(address(plvGlpRouter), _inputAmount);
        plvGlpRouter.redeem(_inputAmount);

        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _outputToken,
            /* _glpAmount = */ glpAmount,
            _minOutputAmount,
            /* _receiver = */ address(this)
        );

        return amountOut;
    }
}
