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

import { IPendleGLPRegistry } from "./interfaces/IPendleGLPRegistry.sol";
import { IPendleRouter } from "./interfaces/IPendleRouter.sol";
import { IPendlePtToken } from "./interfaces/IPendlePtToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   PtGLPTransformer
 * @author  Dolomite
 *
 * @notice  Contract for PtGLP transformer implementation
 */
contract PtGLPTransformer {
    using SafeERC20 for IPendlePtToken;

    IPendleGLPRegistry public immutable PENDLE_REGISTRY; // solhint-disable-line var-name-mixedcase

    constructor(address _pendleRegistry) {
        PENDLE_REGISTRY = IPendleGLPRegistry(_pendleRegistry);
    }
    
    // @follow-up Do we need minAmountOut to prevent sandwich attacks?
    function transform(uint256 _inputAmount, bytes calldata _extraData) external returns (uint256) {
        (
            IPendleRouter.TokenOutput memory tokenOutput
        ) = abi.decode(_extraData, (IPendleRouter.TokenOutput));

        IPendleRouter pendleRouter = PENDLE_REGISTRY.pendleRouter();
        PENDLE_REGISTRY.ptGlpToken().safeApprove(address(pendleRouter), _inputAmount);
        (uint256 glpAmount,) = pendleRouter.swapExactPtForToken(
            /* _receiver */ address(this),
            address(PENDLE_REGISTRY.ptGlpMarket()),
            _inputAmount,
            tokenOutput
        );
        return glpAmount;
    }
}