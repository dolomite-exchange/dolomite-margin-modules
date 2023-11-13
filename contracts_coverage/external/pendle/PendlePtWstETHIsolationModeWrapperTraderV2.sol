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
import { IPendleWstETHRegistry } from "../interfaces/pendle/IPendleWstETHRegistry.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IsolationModeWrapperTraderV2 } from "../proxies/abstract/IsolationModeWrapperTraderV2.sol";

/**
 * @title   PendlePtGLP2024IsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping ptGLP (via swapping against the Pendle AMM then redeeming the underlying GLP to
 *          USDC).
 */
contract PendlePtWstETHIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtWstETHWrapperV2";

    // ============ Constructor ============

    IPendleWstETHRegistry public immutable PENDLE_REGISTRY; // solhint-disable-line var-name-mixedcase
    IERC20 public immutable WST_ETH; // solhint-disable-line var-name-mixedcase
    uint256 public immutable WST_ETH_MARKET_ID; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _pendleRegistry,
        address _wstEth,
        address _dptWstEth,
        address _dolomiteMargin
    )
    IsolationModeWrapperTraderV2(
        _dptWstEth,
        _dolomiteMargin
    ) {
        WST_ETH = IERC20(_wstEth);
        WST_ETH_MARKET_ID = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_wstEth);
        PENDLE_REGISTRY = IPendleWstETHRegistry(_pendleRegistry);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _inputToken == address(WST_ETH);
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
        WST_ETH.safeApprove(address(pendleRouter), _inputAmount);
        (uint256 ptWstEthAmount,) = pendleRouter.swapExactTokenForPt(
            /* _receiver = */ address(this),
            address(PENDLE_REGISTRY.ptWstEth2024Market()),
            _minOutputAmount,
            guessPtOut,
            tokenInput
        );

        return ptWstEthAmount;
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
