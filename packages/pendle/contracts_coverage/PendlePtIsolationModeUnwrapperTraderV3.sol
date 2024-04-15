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

import { IsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPendlePtToken } from "./interfaces/IPendlePtToken.sol";
import { IPendleRegistry } from "./interfaces/IPendleRegistry.sol";
import { IPendleRouterV3 } from "./interfaces/IPendleRouterV3.sol";


/**
 * @title   PendlePtIsolationModeUnwrapperTraderV3
 * @author  Dolomite
 *
 * @notice  Used for unwrapping pt (via swapping against the Pendle AMM)
 */
contract PendlePtIsolationModeUnwrapperTraderV3 is IsolationModeUnwrapperTraderV2 {
    using SafeERC20 for IERC20;
    using SafeERC20 for IPendlePtToken;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtUnwrapperV3";

    // ============ State Variables ============

    IPendleRegistry public immutable PENDLE_REGISTRY; // solhint-disable-line var-name-mixedcase
    IERC20 public immutable UNDERLYING_TOKEN; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _pendleRegistry,
        address _underlyingToken,
        address _dptToken,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _dptToken,
        _dolomiteMargin,
        address(IPendleRegistry(_pendleRegistry).dolomiteRegistry())
    ) {
        PENDLE_REGISTRY = IPendleRegistry(_pendleRegistry);
        UNDERLYING_TOKEN = IERC20(_underlyingToken);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == address(UNDERLYING_TOKEN);
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address,
        uint256,
        address,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
        internal
        override
        returns (uint256)
    {
        (
            IPendleRouterV3.TokenOutput memory tokenOutput,
            IPendleRouterV3.LimitOrderData memory limitOrderData
        ) = abi.decode(_extraOrderData, (IPendleRouterV3.TokenOutput, IPendleRouterV3.LimitOrderData));

        // redeem pt for underlying
        IPendleRouterV3 pendleRouter = IPendleRouterV3(address(PENDLE_REGISTRY.pendleRouter()));
        IERC20(VAULT_FACTORY.UNDERLYING_TOKEN()).safeApprove(address(pendleRouter), _inputAmount);
        (uint256 outputAmount,,) = pendleRouter.swapExactPtForToken(
            /* _receiver */ address(this),
            address(PENDLE_REGISTRY.ptMarket()),
            _inputAmount,
            tokenOutput,
            limitOrderData
        );

        return outputAmount;
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
