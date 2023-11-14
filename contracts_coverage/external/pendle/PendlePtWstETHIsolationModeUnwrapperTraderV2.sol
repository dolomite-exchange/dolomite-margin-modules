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
import { IPendlePtWstETHIsolationModeVaultFactory } from "../interfaces/pendle/IPendlePtWstETHIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IPendleRouter } from "../interfaces/pendle/IPendleRouter.sol";
import { IPendleWstETHRegistry } from "../interfaces/pendle/IPendleWstETHRegistry.sol";
import { IsolationModeUnwrapperTraderV2 } from "../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   PendlePtWstETHIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping ptWstETH (via swapping against the Pendle AMM)
 */
contract PendlePtWstETHIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using SafeERC20 for IERC20;
    using SafeERC20 for IPendlePtToken;

    // ============ Constants ============

    bytes32 private constant _FILE = "PendlePtWstETHUnwrapperV2";

    // ============ State Variables ============

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
    IsolationModeUnwrapperTraderV2(
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

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == address(WST_ETH);
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

        // redeem ptWstETH for wstETH
        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        IERC20(VAULT_FACTORY.UNDERLYING_TOKEN()).safeApprove(address(pendleRouter), _inputAmount);

        (uint256 wstETHAmount,) = pendleRouter.swapExactPtForToken(
            /* _receiver */ address(this),
            address(IPendlePtWstETHIsolationModeVaultFactory(address(VAULT_FACTORY)).pendlePtWstEthMarket()),
            _inputAmount,
            tokenOutput
        );

        // @follow-up Is this check necessary?
        if (wstETHAmount >= _minOutputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(wstETHAmount >= _minOutputAmount,
            _FILE,
            "Insufficient output amount"
        );

        return wstETHAmount;
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
