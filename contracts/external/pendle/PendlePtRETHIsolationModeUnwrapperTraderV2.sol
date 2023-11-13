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
import { IPendleRETHRegistry } from "../interfaces/pendle/IPendleRETHRegistry.sol";
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IsolationModeUnwrapperTraderV2 } from "../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   PendlePtRETHIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping ptRETH (via swapping against the Pendle AMM)
 */
contract PendlePtRETHIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using SafeERC20 for IERC20;
    using SafeERC20 for IPendlePtToken;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtRETHUnwrapperV2";

    // ============ State Variables ============

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
    IsolationModeUnwrapperTraderV2(
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

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == address(RETH);
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
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
            IPendleRouter.TokenOutput memory tokenOutput
        ) = abi.decode(_extraOrderData, (IPendleRouter.TokenOutput));

        // redeem ptRETH for wstETH
        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        PENDLE_REGISTRY.ptRETHToken().safeApprove(address(pendleRouter), _inputAmount);
        (uint256 rETHAmount,) = pendleRouter.swapExactPtForToken(
            /* _receiver */ address(this),
            address(PENDLE_REGISTRY.ptRETHMarket()),
            _inputAmount,
            tokenOutput
        );

        // @follow-up Is this check necessary?
        Require.that(
            rETHAmount >= _minOutputAmount,
            _FILE,
            "Insufficient output amount"
        );

        return rETHAmount;
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
