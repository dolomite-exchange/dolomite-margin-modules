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
import { IPendleRETHRegistry } from "../interfaces/pendle/IPendleRETHRegistry.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IsolationModeWrapperTraderV2 } from "../proxies/abstract/IsolationModeWrapperTraderV2.sol";

/**
 * @title   PendlePtRETHIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping ptGLP (via swapping against the Pendle AMM then redeeming the underlying GLP to
 *          USDC).
 */
contract PendlePtRETHIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtRETHWrapperV2";

    // ============ Constructor ============

    IPendleRETHRegistry public immutable PENDLE_REGISTRY; // solhint-disable-line var-name-mixedcase
    IERC20 public immutable RETH; // solhint-disable-line var-name-mixedcase
    uint256 public immutable RETH_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _pendleRegistry,
        address _rETH,
        address _dptRETH,
        address _dolomiteMargin
    )
    IsolationModeWrapperTraderV2(
        _dptRETH,
        _dolomiteMargin
    ) {
        RETH = IERC20(_rETH);
        RETH_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_rETH);
        PENDLE_REGISTRY = IPendleRETHRegistry(_pendleRegistry);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _inputToken == address(RETH);
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

        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        RETH.safeApprove(address(pendleRouter), _inputAmount);
        (uint256 ptRETHAmount,) = pendleRouter.swapExactTokenForPt(
            /* _receiver = */ address(this),
            address(PENDLE_REGISTRY.ptRETHMarket()),
            _minOutputAmount,
            guessPtOut,
            tokenInput
        );

        return ptRETHAmount;
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
