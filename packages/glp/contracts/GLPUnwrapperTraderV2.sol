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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginExchangeWrapper.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { GLPMathLib } from "@dolomite-exchange/modules-glp/contracts/GLPMathLib.sol";
import { IGmxRegistryV1 } from "@dolomite-exchange/modules-glp/contracts/interfaces/IGmxRegistryV1.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   MagicGLPUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping magicGLP (via redeeming from the ERC 4626 vault then redeeming the underlying GLP to
 *          USDC).
 */
contract MagicGLPUnwrapperTraderV2 is IDolomiteMarginExchangeWrapper, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "MagicGLPUnwrapperTraderV2";

    // ============ Constructor ============

    IERC20 public immutable GLP; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _magicGlp,
        address _gmxRegistry,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        GLP = IERC4626(_magicGlp);
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function exchange(
        address,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        Require.that(
            _inputToken == address(GLP),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // redeem GLP for `_outputToken`; we don't need to approve because GLP has a handler that auto-approves for this
        (uint256 minOutputAmount) = abi.decode(_orderData, (uint256));
        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            _outputToken,
            _inputAmount,
            minOutputAmount,
            /* _receiver = */ address(this)
        );

        // approve the `_outputToken` to be spent by the receiver
        IERC20(_outputToken).safeApprove(_receiver, amountOut);
        return amountOut;
    }

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory /* _orderData */
    )
    public
    override
    view
    returns (uint256) {
        Require.that(
            _inputToken == address(GLP),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256 glpAmount = GLP.previewRedeem(_desiredInputAmount);
        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, glpAmount);
        return GLPMathLib.getGlpRedemptionAmount(GMX_REGISTRY.gmxVault(), _outputToken, usdgAmount);
    }
}
