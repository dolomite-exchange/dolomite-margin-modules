import { ApproxParamsStruct, BaseRouter, TokenInput, TokenOutput } from '@pendle/sdk-v2';
import axios from 'axios';
import { BigNumberish, ethers } from 'ethers';
import { ADDRESS_ZERO, BYTES_EMPTY, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';

export const ONE_TENTH_OF_ONE_BIPS_NUMBER = 0.00001; // 0.001%
export const PENDLE_SDK_BASE_URL = 'https://api-v2.pendle.finance/sdk/api/v1';

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
  minOutputAmount: BigNumberish,
  tokenOut: string,
): Promise<{
  extraOrderData: string
}> {
  const extraOrderData = ethers.utils.defaultAbiCoder.encode(
    ['tuple(address,uint256,address,address,tuple(uint8,address,bytes,bool))'],
    [
      [
        tokenOut,
        minOutputAmount,
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

export async function encodeSwapExactYtForTokensV3(
  network: string,
  receiver: string,
  ptMarket: string,
  ytAmountIn: BigNumberish,
  tokenOut: string,
  slippageTolerance: number,
  syTokenOutAddr: string = ADDRESS_ZERO,
): Promise<{
  extraOrderData: string;
  minTokenOutput: BigNumberish;
}> {
  const res = await axios.get(`${PENDLE_SDK_BASE_URL}/swapExactYtForToken`, {
    params: {
      chainId: network,
      receiverAddr: receiver,
      marketAddr: ptMarket,
      amountYtIn: ytAmountIn.toString(),
      tokenOutAddr: tokenOut,
      slippage: slippageTolerance.toString(),
    },
  });
  const tokenOutputType = 'tuple(address,uint256,address,address,tuple(uint8,address,bytes,bool))';
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
    [tokenOutputType, limitOrderDataInputType as any],
    [
      [
        res.data.contractCallParams['3'].tokenOut,
        res.data.contractCallParams['3'].minTokenOut,
        res.data.contractCallParams['3'].tokenRedeemSy,
        res.data.contractCallParams['3'].pendleSwap,
        [
          res.data.contractCallParams['3'].swapData.swapType,
          res.data.contractCallParams['3'].swapData.extRouter,
          res.data.contractCallParams['3'].swapData.extCalldata,
          res.data.contractCallParams['3'].swapData.needScale,
        ],
      ],
      [
        res.data.contractCallParams['4'].limitRouter,
        res.data.contractCallParams['4'].epsSkipMarket,
        res.data.contractCallParams['4'].normalFills,
        res.data.contractCallParams['4'].flashFills,
        res.data.contractCallParams['4'].optData,
      ]
    ],
  );

  return { extraOrderData, minTokenOutput: res.data.contractCallParams['3'].minTokenOut };
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

export async function encodeSwapExactTokensForYtV3(
  network: string,
  receiver: string,
  ptMarket: string,
  tokenIn: string,
  tokenAmountIn: BigNumberish,
  slippageTolerance: number,
): Promise<{
  extraOrderData: string;
  minAmountOut: BigNumberish;
}> {
  const res = await axios.get(`${PENDLE_SDK_BASE_URL}/swapExactTokenForYt`, {
    params: {
      chainId: network,
      receiverAddr: receiver,
      marketAddr: ptMarket,
      tokenInAddr: tokenIn,
      amountTokenIn: tokenAmountIn.toString(),
      slippage: slippageTolerance.toString(),
    },
  });

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
        res.data.contractCallParams['3'].guessMin,
        res.data.contractCallParams['3'].guessMax,
        res.data.contractCallParams['3'].guessOffchain,
        res.data.contractCallParams['3'].maxIteration,
        res.data.contractCallParams['3'].eps,
      ],
      [
        res.data.contractCallParams['4'].tokenIn,
        res.data.contractCallParams['4'].netTokenIn,
        res.data.contractCallParams['4'].tokenMintSy,
        res.data.contractCallParams['4'].pendleSwap,
        [
          res.data.contractCallParams['4'].swapData.swapType,
          res.data.contractCallParams['4'].swapData.extRouter,
          res.data.contractCallParams['4'].swapData.extCalldata,
          res.data.contractCallParams['4'].swapData.needScale,
        ],
      ],
      [
        res.data.contractCallParams['5'].limitRouter,
        res.data.contractCallParams['5'].epsSkipMarket,
        res.data.contractCallParams['5'].normalFills,
        res.data.contractCallParams['5'].flashFills,
        res.data.contractCallParams['5'].optData,
      ]
    ],
  );

  return { extraOrderData , minAmountOut: res.data.data.amountYtOut };
}
