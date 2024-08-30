import { address } from '@dolomite-exchange/dolomite-margin';
import { GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import axios from 'axios';
import { BigNumber, ContractTransaction } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { GenericTraderParamStruct } from '../../src/utils';
import { expectThrow } from './assertions';

import { CoreProtocolArbitrumOne } from './core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolType } from './setup';

const ODOS_API_URL = 'https://api.odos.xyz';
const PARASWAP_API_URL = 'https://apiv5.paraswap.io';

export interface TraderOutput {
  calldata: string;
  outputAmount: BigNumber;
}

export enum ParaswapSwapType {
  Mega = 'megaSwap',
  Multi = 'multiSwap',
  Simple = 'simpleSwap',
}

const allSwapTypes: ParaswapSwapType[] = [
  ParaswapSwapType.Mega,
  ParaswapSwapType.Multi,
  ParaswapSwapType.Simple,
];

export enum ParaswapSwapSelector {
  Mega = '0x46c67b6d',
  Multi = '0xa94e78ef',
  Simple = '0x54e3f31b',
}

export async function getCalldataForOdos<T extends Network>(
  inputAmount: BigNumber,
  inputToken: { address: address },
  inputDecimals: number,
  minOutputAmount: BigNumber,
  outputToken: { address: address },
  outputDecimals: number,
  txOrigin: { address: address },
  core: CoreProtocolType<T>,
): Promise<TraderOutput> {
  const quoteResponse = await axios.post(`${ODOS_API_URL}/sor/quote/v2`, {
    chainId: core.config.network, // Replace with desired chainId
    inputTokens: [
      {
        tokenAddress: inputToken.address,
        amount: inputAmount.toString(),
      },
    ],
    outputTokens: [
      {
        tokenAddress: outputToken.address,
        proportion: 1,
      },
    ],
    userAddr: txOrigin.address,
    slippageLimitPercent: 0.3, // 30 bips
    referralCode: '0',
    sourceBlacklist: ['Hashflow'],
    compact: false,
  }).then(response => response.data)
    .catch((error) => {
      console.error({
        error,
        message: 'Found error in odos#quote',
      });
      return undefined;
    });
  if (!quoteResponse) {
    // GUARD: If we don't have a price route, we can't execute the trade
    return Promise.reject(new Error('No price route'));
  }

  const result = await axios.post(`${ODOS_API_URL}/sor/assemble`, {
    userAddr: txOrigin.address,
    pathId: quoteResponse.pathId,
    simulate: false,
  })
    .then(response => response.data)
    .catch(error => {
      console.log({
        message: 'Found error in odos#assemble',
        errorMessage: error.message,
        data: error.response.data,
      });

      return undefined;
    });
  if (!result) {
    // GUARD: If we don't have the result, we can't execute the trade
    return Promise.reject(new Error('No result'));
  }

  return {
    calldata: `0x${result.transaction.data.slice(10)}`, // get rid of the method ID
    outputAmount: BigNumber.from(result.outputTokens?.[0]?.amount),
  };
}

export async function getCalldataForOogaBooga(
  inputToken: { address: address },
  inputAmount: BigNumber,
  outputToken: { address: address },
  receiver: { address: address },
): Promise<TraderOutput> {
  const result = await axios.get('https://bartio.api.oogabooga.io/v1/swap', {
      headers: { Authorization: 'Bearer 7nG3aKxmGsEf7TzqPgpuoqSXjS22AZDxC8qxwZkXOIQ' },
      params: {
        tokenIn: inputToken.address,
        tokenOut: outputToken.address,
        amount: inputAmount.toString(),
        to: receiver.address
      }
  })
    .then(response => response.data)
    .catch((error) => {
      console.error('Found error in prices', error);
      throw error;
    });

  return {
    calldata: `0x${result.tx.data.slice(10)}`, // get rid of the method ID
    outputAmount: BigNumber.from(result.routerParams.swapTokenInfo.outputQuote)
  };
}

export async function getCalldataForParaswap<T extends Network>(
  inputAmount: BigNumber,
  inputToken: { address: address },
  inputDecimals: number,
  minOutputAmount: BigNumber,
  outputToken: { address: address },
  outputDecimals: number,
  txOrigin: { address: address },
  receiver: { address: address },
  core: CoreProtocolType<T>,
  swapTypes: ParaswapSwapType[] = allSwapTypes,
): Promise<TraderOutput> {
  if (swapTypes.length === 0) {
    return Promise.reject(new Error('swapTypes is empty'));
  }
  const priceRouteResponse = await axios.get(`${PARASWAP_API_URL}/prices`, {
    params: {
      network: core.config.network,
      srcToken: inputToken.address,
      srcDecimals: inputDecimals,
      destToken: outputToken.address,
      destDecimals: outputDecimals,
      amount: inputAmount.toString(),
      includeContractMethods: swapTypes.join(','),
    },
  })
    .then(response => response.data)
    .catch((error) => {
      console.error('Found error in prices', error);
      throw error;
    });

  const queryParams = new URLSearchParams({
    ignoreChecks: 'true',
    ignoreGasEstimate: 'true',
    onlyParams: 'false',
  }).toString();
  const result = await axios.post(`${PARASWAP_API_URL}/transactions/${core.config.network}?${queryParams}`, {
    priceRoute: priceRouteResponse?.priceRoute,
    txOrigin: txOrigin.address,
    srcToken: inputToken.address,
    srcDecimals: inputDecimals,
    destToken: outputToken.address,
    destDecimals: outputDecimals,
    srcAmount: inputAmount.toString(),
    destAmount: minOutputAmount.toString(),
    userAddress: receiver.address,
    receiver: receiver.address,
    deadline: 9999999999,
    partnerAddress: core.governance.address,
    partnerFeeBps: '0',
    positiveSlippageToUser: false,
  })
    .then(response => response.data)
    .catch((error) => {
      console.error('Found error in transactions', error);
      throw error;
    });

  return {
    calldata: result.data,
    outputAmount: BigNumber.from(BigNumber.from(priceRouteResponse.priceRoute.destAmount)),
  };
}

export async function checkForParaswapSuccess(
  contractTransactionPromise: Promise<ContractTransaction>,
): Promise<boolean> {
  try {
    const txResult = await contractTransactionPromise;
    const receipt = await txResult.wait();
    console.log('\t#liquidate gas used:', receipt.gasUsed.toString());
    return true;
  } catch (e) {
    await expectThrow(
      contractTransactionPromise,
      'ParaswapAggregatorTrader: External call failed',
    );
    console.warn(
      '\tParaswap call failed. This can happen when mixing a mainnet data with the test environment. Skipping the rest of the test',
    );
    return false;
  }
}

export function swapTypeToSelector(swapType: ParaswapSwapType): ParaswapSwapSelector {
  switch (swapType) {
    case ParaswapSwapType.Mega:
      return ParaswapSwapSelector.Mega;
    case ParaswapSwapType.Multi:
      return ParaswapSwapSelector.Multi;
    case ParaswapSwapType.Simple:
      return ParaswapSwapSelector.Simple;
    default:
      throw new Error(`Unknown swap type ${swapType}`);
  }
}

export function getParaswapTraderParamStruct(
  core: CoreProtocolArbitrumOne,
  encodedTradeData: string,
): GenericTraderParamStruct {
  return {
    traderType: GenericTraderType.ExternalLiquidity,
    makerAccountIndex: 0,
    trader: core.paraswapEcosystem.live.paraswapTrader.address,
    tradeData: encodedTradeData,
  };
}
