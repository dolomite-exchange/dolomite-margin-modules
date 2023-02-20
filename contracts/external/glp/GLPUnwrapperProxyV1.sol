// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";

import { IGLPManager } from "../interfaces/IGLPManager.sol";
import { IGLPRewardsRouterV2 } from "../interfaces/IGLPRewardsRouterV2.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "../interfaces/IGmxVault.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultV1 } from "../interfaces/IWrappedTokenUserVaultV1.sol";
import { ILiquidityTokenUnwrapperForLiquidation } from "../interfaces/ILiquidityTokenUnwrapperForLiquidation.sol";

import { WrappedTokenUserVaultUnwrapper } from "../proxies/WrappedTokenUserVaultUnwrapper.sol";

import { GLPMathLib } from "./GLPMathLib.sol";


/**
 * @title GLPUnwrapperProxyV1
 * @author Dolomite
 *
 * @notice  Contract for unwrapping GLP via a "redemption" to USDC
 */
contract GLPUnwrapperProxyV1 is WrappedTokenUserVaultUnwrapper {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPUnwrapperProxyV1";
    uint256 private constant _ACTIONS_LENGTH = 2;

    // ============ Immutable State Variables ============

    address public immutable USDC; // solhint-disable-line var-name-mixedcase
    uint256 public immutable USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _gmxRegistry,
        address _dfsGlp,
        uint256 _actionsLength,
        address _dolomiteMargin
    )
    WrappedTokenUserVaultUnwrapper(_dfsGlp, _actionsLength, _dolomiteMargin) {
        USDC = _usdc;
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);

        USDC_MARKET_ID = IDolomiteMargin(_dolomiteMargin).getMarketIdByTokenAddress(_usdc);
        IERC20(_usdc).safeApprove(_dolomiteMargin, type(uint256).max);
    }

    // ============================================
    // ============ External Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _makerToken,
        uint256 _minMakerAmount,
        address _takerTokenUnderlying,
        uint256 _amountTakerToken,
        bytes calldata
    )
    internal
    override
    returns (uint256) {
        Require.that(
            _makerToken == USDC,
            _FILE,
            "Maker token must be USDC",
            _makerToken
        );

        {
            uint256 balance = IERC20(_takerTokenUnderlying).balanceOf(address(this));
            Require.that(
                balance >= _amountTakerToken,
                _FILE,
                "Insufficient fsGLP for trade",
                balance
            );
        }

        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _makerToken,
            /* _glpAmount = */ _amountTakerToken,
            _minMakerAmount,
            /* _receiver = */ address(this)
        );

        return amountOut;
    }

    function outputMarketId() external override view returns (uint256) {
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
        Require.that(
            _makerToken == address(VAULT_FACTORY),
            _FILE,
            "Maker token must be dfsGLP",
            _makerToken
        );
        Require.that(
            _takerToken == USDC,
            _FILE,
            "Taker token must be USDC",
            _takerToken
        );
        IGmxVault gmxVault = GMX_REGISTRY.gmxVault();

        // This code is taken from the GMX contracts for calculating the redemption amount
        // https://arbiscan.io/address/0x3963ffc9dff443c2a94f21b129d429891e32ec18#code
        // Look in the #_removeLiquidity function
        uint256 aumInUsdg = GMX_REGISTRY.glpManager().getAumInUsdg(false);
        uint256 glpSupply = GMX_REGISTRY.glp().totalSupply();
        uint256 usdgAmount = _desiredMakerToken * aumInUsdg / glpSupply; // GLP supply is always > 0 here

        // GMX VAULT - Taken from https://arbiscan.io/address/0x489ee077994b6658eafa855c308275ead8097c4a#code
        // in the #sellUSDG function
        uint256 redemptionAmount = gmxVault.getRedemptionAmount(_takerToken, usdgAmount);

        uint256 feeBasisPoints = gmxVault.getFeeBasisPoints(
            _takerToken,
            usdgAmount,
            gmxVault.mintBurnFeeBasisPoints(),
            gmxVault.taxBasisPoints(),
            /* _increment = */ false
        );
        return GLPMathLib.applyFeesToAmount(redemptionAmount, feeBasisPoints);
        // END vault code snippet
    }
}
