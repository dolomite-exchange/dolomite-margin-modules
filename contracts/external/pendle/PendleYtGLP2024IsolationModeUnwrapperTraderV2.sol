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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Require } from "../../protocol/lib/Require.sol";

import { IGmxRegistryV1 } from "../interfaces/gmx/IGmxRegistryV1.sol";
import { IPendleGLPRegistry } from "../interfaces/pendle/IPendleGLPRegistry.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IPendleYtToken } from "../interfaces/pendle/IPendleYtToken.sol";
import { IsolationModeUnwrapperTraderV2 } from "../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   PendleYtGLP2024IsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping ytGLP (via swapping against the Pendle AMM then redeeming the underlying GLP to
 *          USDC).
 */
contract PendleYtGLP2024IsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using SafeERC20 for IERC20;
    using SafeERC20 for IPendleYtToken;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendleYtGLP2024UnwrapperV2";

    // ============ Constructor ============

    IPendleGLPRegistry public immutable PENDLE_REGISTRY; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _pendleRegistry,
        address _gmxRegistry,
        address _dytGlp,
        address _dolomiteMargin
    ) 
    IsolationModeUnwrapperTraderV2(
        _dytGlp,
        _dolomiteMargin
    ) {
        PENDLE_REGISTRY = IPendleGLPRegistry(_pendleRegistry);
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function isValidOutputToken(address _outputToken) public view override returns (bool) {
        return GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken);
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _outputToken,
        uint256 _minOutputAmount,
        address,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    ) 
        internal 
        override 
        returns (uint256) 
    {
        (
        IPendleRouter.TokenOutput memory tokenOutput
        ) = abi.decode(_extraOrderData, (IPendleRouter.TokenOutput));

        // redeem ytGLP for GLP
        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        PENDLE_REGISTRY.ytGlpToken().safeApprove(address(pendleRouter), _inputAmount);
        (uint256 glpAmount, ) = pendleRouter.swapExactYtForToken(
            /* _receiver */ address(this),
            address(PENDLE_REGISTRY.ptGlpMarket()),
            _inputAmount,
            tokenOutput
        );

        // redeem GLP for `_outputToken`; we don't need to approve sGLP because there is a handler that auto-approves
        // for this
        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _outputToken,
            glpAmount,
            _minOutputAmount,
            /* _receiver = */ address(this)
        );

        return amountOut;
    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override 
    pure 
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }
}
