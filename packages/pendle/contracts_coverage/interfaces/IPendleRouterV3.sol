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
 * @title   IPendleRouterV3
 * @author  Dolomite
 *
 * @notice  Router contract for selling ptTokens for underlying assets
 */
interface IPendleRouterV3 {

    enum OrderType {
        SY_FOR_PT,
        PT_FOR_SY,
        SY_FOR_YT,
        YT_FOR_SY
    }

    enum SwapType {
        NONE,
        KYBERSWAP,
        ONE_INCH,
        // ETH_WETH not used in Aggregator
        ETH_WETH
    }

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

    struct TokenInput {
        // TOKEN DATA
        address tokenIn;
        uint256 netTokenIn;
        address tokenMintSy;
        // AGGREGATOR DATA
        address pendleSwap;
        SwapData swapData;
    }

    struct TokenOutput {
        // TOKEN DATA
        address tokenOut;
        uint256 minTokenOut;
        address tokenRedeemSy;
        // AGGREGATOR DATA
        address pendleSwap;
        SwapData swapData;
    }

    struct LimitOrderData {
        address limitRouter;
        uint256 epsSkipMarket; // only used for swap operations, will be ignored otherwise
        FillOrderParams[] normalFills;
        FillOrderParams[] flashFills;
        bytes optData;
    }

    struct Order {
        uint256 salt;
        uint256 expiry;
        uint256 nonce;
        OrderType orderType;
        address token;
        address YT;
        address maker;
        address receiver;
        uint256 makingAmount;
        uint256 lnImpliedRate;
        uint256 failSafeRate;
        bytes permit;
    }

    struct FillOrderParams {
        Order order;
        bytes signature;
        uint256 makingAmount;
    }

    function swapExactTokenForPt(
        address receiver,
        address market,
        uint256 minPtOut,
        ApproxParams calldata guessPtOut,
        TokenInput calldata input,
        LimitOrderData calldata limit
    ) external payable returns (uint256 netPtOut, uint256 netSyFee, uint256 netSyInterm);

    function swapExactPtForToken(
        address receiver,
        address market,
        uint256 exactPtIn,
        TokenOutput calldata output,
        LimitOrderData calldata limit
    ) external returns (uint256 netTokenOut, uint256 netSyFee, uint256 netSyInterm);

    function swapExactTokenForYt(
        address receiver,
        address market,
        uint256 minYtOut,
        ApproxParams calldata guessYtOut,
        TokenInput calldata input,
        LimitOrderData calldata limit
    ) external payable returns (uint256 netYtOut, uint256 netSyFee, uint256 netSyInterm);

    function swapExactYtForToken(
        address receiver,
        address market,
        uint256 exactYtIn,
        TokenOutput calldata output,
        LimitOrderData calldata limit
    ) external returns (uint256 netTokenOut, uint256 netSyFee, uint256 netSyInterm);

    function mintPyFromSy(
        address receiver,
        address YT,
        uint256 netSyIn,
        uint256 minPyOut
    ) external returns (uint256 netPyOut);

    function redeemPyToToken(
        address receiver,
        address YT,
        uint256 netPyIn,
        TokenOutput calldata output
    ) external returns (uint256 netTokenOut);

    function redeemSyToToken(
        address receiver,
        address SY,
        uint256 netSyIn,
        TokenOutput calldata output
    ) external returns (uint256 netTokenOut);
}
