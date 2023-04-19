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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { GLPMathLib } from "../glp/GLPMathLib.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IDolomiteMarginUnwrapperTrader } from "../interfaces/IDolomiteMarginUnwrapperTrader.sol";
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";


/**
 * @title   MagicGLPUnwrapperTrader
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GLP (via minting from the GLPRewardsRouter) from USDC. Upon settlement, the minted GLP
 *          is sent to the user's vault and dfsGLP is minted to `DolomiteMargin`.
 */
contract MagicGLPUnwrapperTrader is IDolomiteMarginUnwrapperTrader, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "MagicGLPUnwrapperTrader";
    uint256 private constant _ACTIONS_LENGTH = 1;

    // ============ Constructor ============

    IERC4626 public immutable MAGIC_GLP; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase
    uint256 public immutable USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _magicGlp,
        address _gmxRegistry,
        uint256 _usdcMarketId,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        MAGIC_GLP = IERC4626(_magicGlp);
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
        USDC_MARKET_ID = _usdcMarketId;
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function exchange(
        address,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256 _amountTakerToken,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        Require.that(
            _takerToken == address(MAGIC_GLP),
            _FILE,
            "Invalid taker token",
            _takerToken
        );
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_makerToken)
                && DOLOMITE_MARGIN.getMarketIdByTokenAddress(_makerToken) == outputMarketId(),
            _FILE,
            "Invalid maker token",
            _makerToken
        );

        // redeem magicGLP for GLP; we don't need to approve since the `_owner` param is msg.sender
        uint256 glpAmount = MAGIC_GLP.redeem(_amountTakerToken, address(this), address(this));

        // redeem GLP for `_makerToken`; we don't need to approve because GLP has a handler that auto-approves for this
        (uint256 minMakerAmount) = abi.decode(_orderData, (uint256));
        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _makerToken,
            glpAmount,
            minMakerAmount,
            /* _receiver = */ address(this)
        );

        // approve the `_makerToken` to be spent by the receiver
        IERC20(_makerToken).safeApprove(_receiver, amountOut);
        return amountOut;
    }

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
            _makerToken == address(MAGIC_GLP),
            _FILE,
            "Invalid maker token",
            _makerToken
        );
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_takerToken)
                && DOLOMITE_MARGIN.getMarketIdByTokenAddress(_takerToken) == outputMarketId(),
            _FILE,
            "Invalid taker token",
            _takerToken
        );

        uint256 glpAmount = MAGIC_GLP.previewRedeem(_desiredMakerToken);
        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, glpAmount);
        return GLPMathLib.getGlpRedemptionAmount(GMX_REGISTRY.gmxVault(), _takerToken, usdgAmount);
    }

    function token() public override view returns (address) {
        return address(MAGIC_GLP);
    }

    function outputMarketId() public override view returns (uint256) {
        return USDC_MARKET_ID;
    }

    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256,
        address,
        address,
        uint256,
        uint256 _inputMarketId,
        uint256,
        uint256 _inputAmount
    )
    public
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);

        uint256 _outputMarketId = outputMarketId();
        uint256 amountOut = getExchangeCost(
            DOLOMITE_MARGIN.getMarketTokenAddress(_inputMarketId),
            DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarketId),
            _inputAmount,
            /* _orderData = */ bytes("")
        );

        actions[0] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarketId,
            _outputMarketId,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ amountOut,
            bytes("")
        );

        return actions;
    }

    function actionsLength() public override pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }
}
