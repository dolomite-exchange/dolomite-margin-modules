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
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteMarginUnwrapperTrader } from "../interfaces/IDolomiteMarginUnwrapperTrader.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { IPendlePtToken } from "../interfaces/IPendlePtToken.sol";
import { IPendleRouter } from "../interfaces/IPendleRouter.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";








/**
 * @title   PendlePtGLPUnwrapperTrader
 * @author  Dolomite
 *
 * @notice  Used for unwrapping ptGLP (via swapping against the Pendle AMM then redeeming the underlying GLP to
 *          USDC).
 */
contract PendlePtGLPUnwrapperTrader is IDolomiteMarginUnwrapperTrader, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;
    using SafeERC20 for IPendlePtToken;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtGLPUnwrapperTrader";
    uint256 private constant _ACTIONS_LENGTH = 1;

    // ============ Constructor ============

    IPendlePtToken public immutable PT_GLP; // solhint-disable-line var-name-mixedcase
    IPendleRouter public immutable PENDLE_ROUTER; // solhint-disable-line var-name-mixedcase
    address public immutable PT_GLP_MARKET; // solhint-disable-line var-name-mixedcase
    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase
    uint256 public immutable USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _ptGlp,
        address _pendleRouter,
        address _ptGlpMarket,
        address _gmxRegistry,
        uint256 _usdcMarketId,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(
        _dolomiteMargin
    ) {
        PT_GLP = IPendlePtToken(_ptGlp);
        PENDLE_ROUTER = IPendleRouter(_pendleRouter);
        PT_GLP_MARKET = _ptGlpMarket;
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
        Require.that(
            _inputToken == address(PT_GLP),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            GMX_REGISTRY.gmxVault().whitelistedTokens(_outputToken)
                && DOLOMITE_MARGIN.getMarketIdByTokenAddress(_outputToken) == outputMarketId(),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (
            uint256 minOutputAmount,
            IPendleRouter.TokenOutput memory tokenOutput
        ) = abi.decode(_orderData, (uint256, IPendleRouter.TokenOutput));

        // redeem ptGLP for GLP
        PT_GLP.safeApprove(address(PENDLE_ROUTER), _inputAmount);
        (uint256 glpAmount,) = PENDLE_ROUTER.swapExactPtForToken(
            /* _receiver */ address(this),
            PT_GLP_MARKET,
            _inputAmount,
            tokenOutput
        );

        // redeem GLP for `_outputToken`; we don't need to approve because GLP has a handler that auto-approves for this
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

    function token() public override view returns (address) {
        return address(PT_GLP);
    }

    function outputMarketId() public override view returns (uint256) {
        return USDC_MARKET_ID;
    }

    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256,
        address,
        address,
        uint256 _outputMarketId,
        uint256 _inputMarketId,
        uint256 _minOutputAmount,
        uint256 _inputAmount
    )
    public
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);
        actions[0] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _inputMarketId,
            _outputMarketId,
            /* _trader = */ address(this),
            /* _amountInWei = */ _inputAmount,
            /* _amountOutMinWei = */ _minOutputAmount,
            bytes("")
        );

        return actions;
    }

    function getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
        public
        override
        pure
        returns (uint256)
    {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), "getExchangeCost is not implemented")));
    }

    function actionsLength() public override pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }
}
