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

import { GLPMathLib } from "@dolomite-exchange/modules-glp/contracts/GLPMathLib.sol";
import { IGmxRegistryV1 } from "@dolomite-exchange/modules-glp/contracts/interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "@dolomite-exchange/modules-glp/contracts/interfaces/IGmxVault.sol";
import { IPlutusVaultGLPRouter } from "./interfaces/IPlutusVaultGLPRouter.sol";
import { IPlutusVaultRegistry } from "./interfaces/IPlutusVaultRegistry.sol";
import { IsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   PlutusVaultGLPIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping plvGLP (via redeeming for GLP and burning GLP via the GLPRewardsRouter) into USDC.
 *          During settlement, the redeemed plvGLP is sent from the user's vault to this contract to process the
 *          unwrapping.
 */
contract PlutusVaultGLPIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using GLPMathLib for IGmxVault;

    // ============ Constants ============

    bytes32 private constant _FILE = "PlutusVaultGLPUnwrapperV2";

    // ============ Immutable State Variables ============

    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase
    IPlutusVaultRegistry public immutable PLUTUS_VAULT_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _gmxRegistry,
        address _plutusVaultRegistry,
        address _dPlvGlp,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _dPlvGlp,
        _dolomiteMargin,
        address(IPlutusVaultRegistry(_plutusVaultRegistry).dolomiteRegistry())
    ) {
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
        PLUTUS_VAULT_REGISTRY = IPlutusVaultRegistry(_plutusVaultRegistry);
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken);
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

    function _getExchangeCost(
        address,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    view
    returns (uint256) {
        (,,uint256 glpAmount) = PLUTUS_VAULT_REGISTRY.plvGlpRouter().previewRedeem(address(this), _desiredInputAmount);

        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, glpAmount);

        return GMX_REGISTRY.gmxVault().getGlpRedemptionAmount(_outputToken, usdgAmount);
    }
}
