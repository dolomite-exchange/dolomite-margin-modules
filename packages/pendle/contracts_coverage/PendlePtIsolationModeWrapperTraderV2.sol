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

import { IsolationModeWrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeWrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPendleRegistry } from "./interfaces/IPendleRegistry.sol";
import { IPendleRouter } from "./interfaces/IPendleRouter.sol";


/**
 * @title   PendlePtIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping pt (via swapping against the Pendle AMM)
 */
contract PendlePtIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtWrapperV2";

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
    IsolationModeWrapperTraderV2(
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

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _inputToken == address(UNDERLYING_TOKEN);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address,
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
            IPendleRouter.ApproxParams memory guessPtOut,
            IPendleRouter.TokenInput memory tokenInput
        ) = abi.decode(_extraOrderData, (IPendleRouter.ApproxParams, IPendleRouter.TokenInput));

        tokenInput.netTokenIn = _inputAmount;

        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        UNDERLYING_TOKEN.safeApprove(address(pendleRouter), _inputAmount);
        (uint256 ptAmount,) = pendleRouter.swapExactTokenForPt(
            /* _receiver = */ address(this),
            address(PENDLE_REGISTRY.ptMarket()),
            _minOutputAmount,
            guessPtOut,
            tokenInput
        );

        return ptAmount;
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
    returns (uint256)
    {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }
}
