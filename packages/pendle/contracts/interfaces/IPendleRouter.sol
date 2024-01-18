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


/**
 * @title   IPendleRouter
 * @author  Dolomite
 *
 * @notice  Router contract for selling ptTokens for underlying assets
 */
interface IPendleRouter {

    struct ApproxParams {
        uint256 guessMin;
        uint256 guessMax;
        /// pass 0 in to skip this variable
        uint256 guessOffchain;
        /// every iteration, the diff between guessMin and guessMax will be divided by 2
        uint256 maxIteration;
        /// the max eps between the returned result & the correct result, base 1e18. Normally this number will be set
        uint256 eps;
        // to 1e15 (1e18/1000 = 0.1%)

        /// Further explanation of the eps. Take swapExactSyForPt for example. To calc the corresponding amount of Pt to
        /// swap out, it's necessary to run an approximation algorithm, because by default there only exists the Pt to
        /// Sy formula
        /// To approx, the 5 values above will have to be provided, and the approx process will run as follows:
        /// mid = (guessMin + guessMax) / 2 // mid here is the current guess of the amount of Pt out
        /// netSyNeed = calcSwapSyForExactPt(mid)
        /// if (netSyNeed > exactSyIn) guessMax = mid - 1 // since the maximum Sy in can't exceed the exactSyIn
        /// else guessMin = mid (1)
        /// For the (1), since netSyNeed <= exactSyIn, the result might be usable. If the netSyNeed is within eps of
        /// exactSyIn (ex eps=0.1% => we have used 99.9% the amount of Sy specified), mid will be chosen as the final
        /// guess result

        /// for guessOffchain, this is to provide a shortcut to guessing. The offchain SDK can precalculate the exact
        /// result before the tx is sent. When the tx reaches the contract, the guessOffchain will be checked first, and
        /// if it satisfies the approximation, it will be used (and save all the guessing). It's expected that this
        /// shortcut will be used in most cases except in cases that there is a trade in the same market right before
        /// the tx
    }

    struct SwapData {
        SwapType swapType;
        address extRouter;
        bytes extCalldata;
        bool needScale;
    }

    enum SwapType {
        NONE,
        KYBERSWAP,
        ONE_INCH,
        // ETH_WETH not used in Aggregator
        ETH_WETH
    }

    struct TokenInput {
        // Token/Sy data
        address tokenIn;
        uint256 netTokenIn;
        address tokenMintSy;
        address bulk;
        // aggregator data
        address pendleSwap;
        SwapData swapData;
    }

    struct TokenOutput {
        // Token/Sy data
        address tokenOut;
        uint256 minTokenOut;
        address tokenRedeemSy;
        address bulk;
        // aggregator data
        address pendleSwap;
        SwapData swapData;
    }

    /**
     * @notice swap (through Kyberswap) from any input token for SY-mintable tokens, then mints SY
     * and swaps said SY for PT
     *
     * @param  input  data for input token, see {`./kyberswap/KyberSwapHelper.sol`}
     * @dev is a combination of `_mintSyFromToken()` and `_swapExactSyForPt()`
     */
    function swapExactTokenForPt(
        address receiver,
        address market,
        uint256 minPtOut,
        ApproxParams calldata guessPtOut,
        TokenInput calldata input
    ) external payable returns (uint256 netPtOut, uint256 netSyFee);

    /**
     * @notice swap from exact amount of PT to SY, then redeem SY for assets, finally swaps
     * resulting assets through Kyberswap to get desired output token
     *
     * @param  receiver      The address to receive output token
     * @param  exactPtIn     There will always consume this much PT for as much SY as possible
     * @param  output        The data for desired output token, see {`./kyberswap/KyberSwapHelper.sol`}
     * @dev This is a combination of `_swapExactPtForSy()` and `_redeemSyToToken()`
     */
    function swapExactPtForToken(
        address receiver,
        address market,
        uint256 exactPtIn,
        TokenOutput calldata output
    ) external returns (uint256 netTokenOut, uint256 netSyFee);

    function swapExactYtForToken(
        address receiver,
        address market,
        uint256 netYtIn,
        TokenOutput calldata output
    ) external returns (uint256 netTokenOut, uint256 netSyFee);

    function swapExactTokenForYt(
        address receiver,
        address market,
        uint256 minYtOut,
        ApproxParams calldata guessYtOut,
        TokenInput calldata input
    ) external payable returns (uint256 netYtOut, uint256 netSyFee);

    function mintPyFromSy(
        address receiver,
        address YT, // solhint-disable-line var-name-mixedcase
        uint256 netSyIn,
        uint256 minPyOut
    ) external returns (uint256 netPyOut);
}
