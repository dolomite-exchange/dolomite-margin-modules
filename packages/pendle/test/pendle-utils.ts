import { ApproxParamsStruct, BaseRouter, TokenInput, TokenOutput } from '@pendle/sdk-v2';
import { BigNumberish, ethers } from 'ethers';
import { ADDRESS_ZERO, BYTES_EMPTY, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';

export const ONE_TENTH_OF_ONE_BIPS_NUMBER = 0.00001; // 0.001%

const ORDER_COMPONENTS = {
  type: 'tuple',
  name: 'order',
  components: [
    { name: 'salt', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'orderType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'YT', type: 'address' },
    { name: 'maker', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'makingAmount', type: 'uint256' },
    { name: 'lnImpliedRate', type: 'uint256' },
    { name: 'failSafeRate', type: 'uint256' },
    { name: 'permit', type: 'bytes' },
  ]
};

export async function encodeSwapExactPtForTokens(
  router: BaseRouter,
  ptAmountIn: BigNumberish,
  slippageTolerance: number,
  market: string,
  tokenOut: string,
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

export async function encodeRedeemPyToToken(
  ptAmountIn: BigNumberish,
  tokenOut: string,
): Promise<{
  extraOrderData: string
}> {
  const extraOrderData = ethers.utils.defaultAbiCoder.encode(
    ['tuple(address,uint256,address,address,tuple(uint8,address,bytes,bool))'],
    [
      [
        tokenOut,
        1,
        tokenOut,
        ADDRESS_ZERO,
        [
          0,
          ADDRESS_ZERO,
          BYTES_EMPTY,
          false,
        ],
      ],
    ],
  );

  return { extraOrderData };
}

export async function encodeSwapExactPtForTokensV3(
  router: BaseRouter,
  ptAmountIn: BigNumberish,
  slippageTolerance: number,
  market: string,
  tokenOut: string,
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

  // Extra Order Data which is IPendleRouterV3.TokenOutput and IPendleRouterV3.LimitOrderData
  const EXTRA_ORDER_DATA_TYPE = [
    {
      type: 'tuple',
      name: 'tokenOutput',
      components: [
        { name: 'tokenOut', type: 'address' },
        { name: 'minTokenOut', type: 'uint256' },
        { name: 'tokenRedeemSy', type: 'address' },
        { name: 'pendleSwap', type: 'address' },
        {
          type: 'tuple',
          name: 'swapData',
          components: [
            { name: 'swapType', type: 'uint8' },
            { name: 'extRouter', type: 'address' },
            { name: 'extCalldata', type: 'bytes' },
            { name: 'needScale', type: 'bool' }
          ]
        }
      ]
    },
    {
      type: 'tuple',
      name: 'limitOrderData',
      components: [
        { name: 'limitRouter', type: 'address' },
        { name: 'epsSkipMarket', type: 'uint256' },
        {
          type: 'tuple[]',
          name: 'normalFills',
          components: [
            ORDER_COMPONENTS,
            { name: 'signature', type: 'bytes' },
            { name: 'makingAmount', type: 'uint256' },
          ]
        },
        {
          type: 'tuple[]',
          name: 'flashFills',
          components: [
            ORDER_COMPONENTS,
            { name: 'signature', type: 'bytes' },
            { name: 'makingAmount', type: 'uint256' },
          ]
        },
        { name: 'optData', type: 'bytes' },
      ]
    }
  ];
  const data = ethers.utils.defaultAbiCoder.encode(
    EXTRA_ORDER_DATA_TYPE as any,
    [
      [
        tokenOutput.tokenOut,
        tokenOutput.minTokenOut,
        tokenOutput.tokenRedeemSy,
        tokenOutput.pendleSwap,
        [
          tokenOutput.swapData.swapType,
          tokenOutput.swapData.extRouter,
          tokenOutput.swapData.extCalldata,
          tokenOutput.swapData.needScale,
        ],
      ],
      [
        ADDRESS_ZERO,
        ZERO_BI,
        [],
        [],
        BYTES_EMPTY
      ]
    ],
  );

  return { extraOrderData: data, tokenOutput: tokenOutput as any };
}

export async function encodeSwapExactTokensForPt(
  router: BaseRouter,
  tokenAmountIn: BigNumberish,
  slippageTolerance: number,
  marketIn: string,
  tokenIn: string,
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

export async function encodeSwapExactTokensForPtV3(
  router: BaseRouter,
  tokenAmountIn: BigNumberish,
  slippageTolerance: number,
  marketIn: string,
  tokenIn: string,
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
  const tokenInputType = 'tuple(address,uint256,address,address,tuple(uint8,address,bytes,bool))';
  const limitOrderDataInputType = {
    type: 'tuple',
    name: 'limitOrderData',
    components: [
      { name: 'limitRouter', type: 'address' },
      { name: 'epsSkipMarket', type: 'uint256' },
      {
        type: 'tuple[]',
        name: 'normalFills',
        components: [
          ORDER_COMPONENTS,
          { name: 'signature', type: 'bytes' },
          { name: 'makingAmount', type: 'uint256' },
        ]
      },
      {
        type: 'tuple[]',
        name: 'flashFills',
        components: [
          ORDER_COMPONENTS,
          { name: 'signature', type: 'bytes' },
          { name: 'makingAmount', type: 'uint256' },
        ]
      },
      { name: 'optData', type: 'bytes' },
    ]
  };
  const extraOrderData = ethers.utils.defaultAbiCoder.encode(
    [approxParamsType, tokenInputType, limitOrderDataInputType as any],
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
        tokenInput.pendleSwap,
        [
          tokenInput.swapData.swapType,
          tokenInput.swapData.extRouter,
          tokenInput.swapData.extCalldata,
          tokenInput.swapData.needScale,
        ],
      ],
      [
        ADDRESS_ZERO,
        ZERO_BI,
        [],
        [],
        BYTES_EMPTY
      ]
    ],
  );

  return { extraOrderData, tokenInput: tokenInput as any, approxParams: approxParams as any };
}

export async function encodeSwapExactYtForTokens(
  router: BaseRouter,
  ytAmountIn: BigNumberish,
  slippageTolerance: number,
  ptMarket: string,
  tokenOut: string,
): Promise<{
  extraOrderData: string;
  tokenOutput: TokenOutput
}> {
  const [, , , tokenOutput] = await router.swapExactYtForToken(
    ptMarket as any,
    ytAmountIn,
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

export async function encodeSwapExactTokensForYt(
  router: BaseRouter,
  tokenAmountIn: BigNumberish,
  slippageTolerance: number,
  ptMarket: string,
  tokenIn: string,
): Promise<{
  extraOrderData: string;
  tokenInput: TokenInput,
  approxParams: ApproxParamsStruct
}> {
  const [, , , approxParams, tokenInput] = await router.swapExactTokenForYt(
    ptMarket as any,
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
