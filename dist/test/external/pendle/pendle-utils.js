"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeSwapExactTokensForPt = exports.encodeSwapExactPtForTokens = exports.ONE_TENTH_OF_ONE_BIPS_NUMBER = void 0;
const ethers_1 = require("ethers");
exports.ONE_TENTH_OF_ONE_BIPS_NUMBER = 0.00001; // 0.001%
async function encodeSwapExactPtForTokens(router, core, ptAmountIn, slippageTolerance = exports.ONE_TENTH_OF_ONE_BIPS_NUMBER, tokenOut = core.gmxEcosystem.sGlp.address) {
    const [, , , tokenOutput] = await router.swapExactPtForToken(core.pendleEcosystem.ptGlpMarket.address, ptAmountIn, tokenOut, exports.ONE_TENTH_OF_ONE_BIPS_NUMBER, { method: 'extractParams' });
    const extraOrderData = ethers_1.ethers.utils.defaultAbiCoder.encode(['tuple(address,uint256,address,address,address,tuple(uint8,address,bytes,bool))'], [
        [
            tokenOutput.tokenOut,
            tokenOutput.minTokenOut,
            tokenOutput.tokenRedeemSy,
            tokenOutput.bulk,
            tokenOutput.pendleSwap,
            [
                tokenOutput.swapData.swapType,
                tokenOutput.swapData.extRouter,
                tokenOutput.swapData.extCalldata,
                tokenOutput.swapData.needScale,
            ],
        ],
    ]);
    return { extraOrderData, tokenOutput: tokenOutput };
}
exports.encodeSwapExactPtForTokens = encodeSwapExactPtForTokens;
async function encodeSwapExactTokensForPt(router, core, tokenAmountIn, slippageTolerance = exports.ONE_TENTH_OF_ONE_BIPS_NUMBER, tokenIn = core.gmxEcosystem.sGlp.address) {
    const [, , , approxParams, tokenInput] = await router.swapExactTokenForPt(core.pendleEcosystem.ptGlpMarket.address, tokenIn, tokenAmountIn, slippageTolerance, { method: 'extractParams' });
    const approxParamsType = 'tuple(uint256,uint256,uint256,uint256,uint256)';
    const tokenInputType = 'tuple(address,uint256,address,address,address,tuple(uint8,address,bytes,bool))';
    const extraOrderData = ethers_1.ethers.utils.defaultAbiCoder.encode([approxParamsType, tokenInputType], [
        [
            approxParams.guessMin,
            approxParams.guessMax,
            approxParams.guessOffchain,
            approxParams.maxIteration,
            approxParams.eps,
        ],
        [
            tokenInput.tokenIn,
            tokenInput.netTokenIn,
            tokenInput.tokenMintSy,
            tokenInput.bulk,
            tokenInput.pendleSwap,
            [
                tokenInput.swapData.swapType,
                tokenInput.swapData.extRouter,
                tokenInput.swapData.extCalldata,
                tokenInput.swapData.needScale,
            ],
        ],
    ]);
    return { extraOrderData, tokenInput: tokenInput, approxParams: approxParams };
}
exports.encodeSwapExactTokensForPt = encodeSwapExactTokensForPt;
