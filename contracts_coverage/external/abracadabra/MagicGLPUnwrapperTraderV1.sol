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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { GLPMathLib } from "../glp/GLPMathLib.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IDolomiteMarginUnwrapperTraderForLiquidatorV3 } from "../interfaces/IDolomiteMarginUnwrapperTraderForLiquidatorV3.sol"; // solhint-disable-line max-line-length
import { IERC4626 } from "../interfaces/IERC4626.sol";
import { IGmxRegistryV1 } from "../interfaces/gmx/IGmxRegistryV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";


/**
 * @title   MagicGLPUnwrapperTraderV1
 * @author  Dolomite
 *
 * @notice  Used for unwrapping magicGLP (via redeeming from the ERC 4626 vault then redeeming the underlying GLP to
 *          USDC).
 */
contract MagicGLPUnwrapperTraderV1 is IDolomiteMarginUnwrapperTraderForLiquidatorV3, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "MagicGLPUnwrapperTraderV1";
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
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        if (_inputToken == address(MAGIC_GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputToken == address(MAGIC_GLP),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken) && DOLOMITE_MARGIN().getMarketIdByTokenAddress(_outputToken) == outputMarketId()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken)
                && DOLOMITE_MARGIN().getMarketIdByTokenAddress(_outputToken) == outputMarketId(),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // redeems magicGLP for GLP; we don't need to approve since the `_owner` parameter is msg.sender
        uint256 glpAmount = MAGIC_GLP.redeem(_inputAmount, address(this), address(this));

        // redeem GLP for `_outputToken`; we don't need to approve because GLP has a handler that auto-approves for this
        (uint256 minOutputAmount) = abi.decode(_orderData, (uint256));
        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _outputToken,
            glpAmount,
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
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        if (_inputToken == address(MAGIC_GLP)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputToken == address(MAGIC_GLP),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken) && DOLOMITE_MARGIN().getMarketIdByTokenAddress(_outputToken) == outputMarketId()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken)
                && DOLOMITE_MARGIN().getMarketIdByTokenAddress(_outputToken) == outputMarketId(),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        uint256 glpAmount = MAGIC_GLP.previewRedeem(_desiredInputAmount);
        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, glpAmount);
        return GLPMathLib.getGlpRedemptionAmount(GMX_REGISTRY.gmxVault(), _outputToken, usdgAmount);
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
            DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarketId),
            DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId),
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
