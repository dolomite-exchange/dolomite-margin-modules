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

import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { IsolationModeWrapperTraderV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeWrapperTraderV1.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { GLPMathLib } from "@dolomite-exchange/modules-glp/contracts/GLPMathLib.sol";
import { IGmxRegistryV1 } from "@dolomite-exchange/modules-glp/contracts/interfaces/IGmxRegistryV1.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPlutusVaultGLPRouter } from "./interfaces/IPlutusVaultGLPRouter.sol";
import { IPlutusVaultRegistry } from "./interfaces/IPlutusVaultRegistry.sol";


/**
 * @title   PlutusVaultGLPIsolationModeWrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Used for wrapping plvGLP (via minting from the GLPRewardsRouter) from a valid input token (like USDC). Upon
 *          wrapping, the minted plvGLP is sent to the user's vault and dplvGLP is minted to `DolomiteMargin`.
 */
contract PlutusVaultGLPIsolationModeWrapperTraderV1 is IsolationModeWrapperTraderV1 {
    using GLPMathLib for *;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "PlutusVaultGLPWrapperV1";

    // ============ Constructor ============

    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase
    IPlutusVaultRegistry public immutable PLUTUS_VAULT_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _gmxRegistry,
        address _plutusVaultRegistry,
        address _dPlvGlp,
        address _dolomiteMargin
    )
    IsolationModeWrapperTraderV1(
        _dPlvGlp,
        _dolomiteMargin
    ) {
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
        PLUTUS_VAULT_REGISTRY = IPlutusVaultRegistry(_plutusVaultRegistry);
    }

    // ============ External Functions ============

    function getExchangeCost(
        address _inputToken,
        address _vaultToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        // VAULT_FACTORY is the DFS_GLP token
        Require.that(
            _vaultToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid output token",
            _vaultToken
        );
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256 usdgAmount = GMX_REGISTRY.gmxVault().getUsdgAmountForBuy(_inputToken, _desiredInputAmount);
        uint256 glpAmount = GMX_REGISTRY.getGlpMintAmount(usdgAmount);
        return IERC4626(VAULT_FACTORY.UNDERLYING_TOKEN()).previewDeposit(glpAmount);
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );

        IERC20(_inputToken).safeApprove(address(GMX_REGISTRY.glpManager()), _inputAmount);

        uint256 glpAmount = GMX_REGISTRY.glpRewardsRouter().mintAndStakeGlp(
            _inputToken,
            _inputAmount,
            /* _minUsdg = */ 0,
            _minOutputAmount
        );

        uint256 outputAmount = PLUTUS_VAULT_REGISTRY.plvGlpToken().previewDeposit(glpAmount);

        IPlutusVaultGLPRouter plvGlpRouter = PLUTUS_VAULT_REGISTRY.plvGlpRouter();
        plvGlpRouter.sGLP().safeApprove(address(plvGlpRouter), glpAmount);
        plvGlpRouter.deposit(glpAmount);

        return outputAmount;
    }
}
