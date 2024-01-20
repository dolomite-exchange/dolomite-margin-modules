import { ApproxParamsStruct, BaseRouter, TokenInput, TokenOutput } from '@pendle/sdk-v2';
import { BigNumberish, ethers } from 'ethers';
import { CoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';

export const ONE_TENTH_OF_ONE_BIPS_NUMBER = 0.00001; // 0.001%

export async function encodeSwapExactPtForTokens(
  router: BaseRouter,
  core: CoreProtocol,
  ptAmountIn: BigNumberish,
  slippageTolerance: number = ONE_TENTH_OF_ONE_BIPS_NUMBER,
  market: string = core.pendleEcosystem!.glpMar2024.ptGlpMarket.address,
  tokenOut: string = core.gmxEcosystem!.sGlp.address,
): Promise<{
  extraOrderData: string;
  tokenOutput: TokenOutput
}> {
  const [, , , tokenOutput] = await router.swapExactPtForToken(
    market as any,
    ptAmountIn,
    tokenOut as any,
    slippageTolerance,
    { method: 'extractParams' },
  );

  const extraOrderData = ethers.utils.defaultAbiCoder.encode(
    ['tuple(address,uint256,address,address,address,tuple(uint8,address,bytes,bool))'],
    [
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
    ],
  );

  return { extraOrderData, tokenOutput: tokenOutput as any };
}

export async function encodeSwapExactTokensForPt(
  router: BaseRouter,
  core: CoreProtocol,
  tokenAmountIn: BigNumberish,
  slippageTolerance: number = ONE_TENTH_OF_ONE_BIPS_NUMBER,
  marketIn: string = core.pendleEcosystem!.glpMar2024.ptGlpMarket.address,
  tokenIn: string = core.gmxEcosystem!.sGlp.address,
): Promise<{
  extraOrderData: string;
  tokenInput: TokenInput,
  approxParams: ApproxParamsStruct
}> {
  const [, , , approxParams, tokenInput] = await router.swapExactTokenForPt(
    marketIn as any,
    tokenIn as any,
    tokenAmountIn,
    slippageTolerance,
    { method: 'extractParams' },
  );

  const approxParamsType = 'tuple(uint256,uint256,uint256,uint256,uint256)';
  const tokenInputType = 'tuple(address,uint256,address,address,address,tuple(uint8,address,bytes,bool))';
  const extraOrderData = ethers.utils.defaultAbiCoder.encode(
    [approxParamsType, tokenInputType],
    [
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
    ],
  );

  return { extraOrderData, tokenInput: tokenInput as any, approxParams: approxParams as any };
}

export async function encodeSwapExactYtForTokens(
  router: BaseRouter,
  core: CoreProtocol,
  ytAmountIn: BigNumberish,
  slippageTolerance: number = ONE_TENTH_OF_ONE_BIPS_NUMBER,
  tokenOut: string = core.gmxEcosystem!.sGlp.address,
): Promise<{
  extraOrderData: string;
  tokenOutput: TokenOutput
}> {
  const [, , , tokenOutput] = await router.swapExactYtForToken(
    core.pendleEcosystem!.glpMar2024.ptGlpMarket.address as any,
    ytAmountIn,
    tokenOut as any,
    ONE_TENTH_OF_ONE_BIPS_NUMBER,
    { method: 'extractParams' },
  );

  const extraOrderData = ethers.utils.defaultAbiCoder.encode(
    ['tuple(address,uint256,address,address,address,tuple(uint8,address,bytes,bool))'],
    [
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
    ],
  );

  return { extraOrderData, tokenOutput: tokenOutput as any };
}

export async function encodeSwapExactTokensForYt(
  router: BaseRouter,
  core: CoreProtocol,
  tokenAmountIn: BigNumberish,
  slippageTolerance: number = ONE_TENTH_OF_ONE_BIPS_NUMBER,
  tokenIn: string = core.gmxEcosystem!.sGlp.address,
): Promise<{
  extraOrderData: string;
  tokenInput: TokenInput,
  approxParams: ApproxParamsStruct
}> {
  const [, , , approxParams, tokenInput] = await router.swapExactTokenForYt(
    core.pendleEcosystem!.glpMar2024.ptGlpMarket.address as any,
    tokenIn as any,
    tokenAmountIn,
    slippageTolerance,
    { method: 'extractParams' },
  );

  const approxParamsType = 'tuple(uint256,uint256,uint256,uint256,uint256)';
  const tokenInputType = 'tuple(address,uint256,address,address,address,tuple(uint8,address,bytes,bool))';
  const extraOrderData = ethers.utils.defaultAbiCoder.encode(
    [approxParamsType, tokenInputType],
    [
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
    ],
  );

  return { extraOrderData, tokenInput: tokenInput as any, approxParams: approxParams as any };
}
