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

import { IDolomiteTransformer } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteTransformer.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPendleGLPRegistry } from "./interfaces/IPendleGLPRegistry.sol";
import { IPendleRouter } from "./interfaces/IPendleRouter.sol";


/**
 * @title   PtGLPTransformer
 * @author  Dolomite
 *
 * @notice  Contract for PtGLP transformer implementation
 */
contract PtGLPTransformer is IDolomiteTransformer {
    using SafeERC20 for IERC20;

    IPendleGLPRegistry public immutable PENDLE_REGISTRY; // solhint-disable-line var-name-mixedcase
    address public immutable inputToken;
    address public immutable outputToken;

    constructor(address _pendleRegistry, address _outputToken) {
        PENDLE_REGISTRY = IPendleGLPRegistry(_pendleRegistry);
        inputToken = address(PENDLE_REGISTRY.ptGlpToken());
        outputToken = _outputToken;
    }
    
    function transform(uint256 _inputAmount, bytes calldata /* extraData */) external returns (uint256) {
        IPendleRouter.SwapData memory swapData = IPendleRouter.SwapData({
            swapType: IPendleRouter.SwapType.NONE,
            extRouter: address(0),
            extCalldata: bytes(''),
            needScale: false
        });
        IPendleRouter.TokenOutput memory tokenOutput = IPendleRouter.TokenOutput({
            tokenOut: outputToken,
            minTokenOut: _inputAmount,
            tokenRedeemSy: outputToken,
            bulk: address(0),
            pendleSwap: address(0),
            swapData: swapData
        });

        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        IERC20(inputToken).safeApprove(address(pendleRouter), _inputAmount);
        uint256 glpAmount = pendleRouter.redeemPyToToken(
            /* _receiver */ address(this),
            address(PENDLE_REGISTRY.ytGlpToken()),
            _inputAmount,
            tokenOutput
        );

        assert(glpAmount == _inputAmount);
        return glpAmount;
    }
}