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
import { IPendlePtToken } from "../interfaces/pendle/IPendlePtToken.sol";
import { IPendleRegistry } from "../interfaces/pendle/IPendleRegistry.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IsolationModeUnwrapperTraderV2 } from "../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   PendlePtIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping pt (via swapping against the Pendle AMM)
 */
contract PendlePtIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using SafeERC20 for IERC20;
    using SafeERC20 for IPendlePtToken;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtUnwrapperV2";

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
        _dolomiteMargin
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
            IPendleRouter.TokenOutput memory tokenOutput
        ) = abi.decode(_extraOrderData, (IPendleRouter.TokenOutput));

        // redeem pt for underlying
        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        IERC20(VAULT_FACTORY.UNDERLYING_TOKEN()).safeApprove(address(pendleRouter), _inputAmount);
        (uint256 outputAmount,) = pendleRouter.swapExactPtForToken(
            /* _receiver */ address(this),
            address(PENDLE_REGISTRY.ptMarket()),
            _inputAmount,
            tokenOutput
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
