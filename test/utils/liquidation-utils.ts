import { address } from '@dolomite-exchange/dolomite-margin';
import { GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import axios from 'axios';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { Account } from '../../src/types/IDolomiteMargin';
import { IGenericTraderProxyBase } from '../../src/types/LiquidatorProxyV4WithGenericTrader';
import { BYTES_EMPTY, NO_EXPIRY } from '../../src/utils/no-deps-constants';
import { expectThrow } from './assertions';
import { CoreProtocol } from './setup';
import TraderParamStruct = IGenericTraderProxyBase.TraderParamStruct;

const API_URL = 'https://apiv5.paraswap.io';

export function getParaswapTraderParamStruct(
  core: CoreProtocol,
  encodedTradeData: string,
): IGenericTraderProxyBase.TraderParamStruct {
  return {
    traderType: GenericTraderType.ExternalLiquidity,
    makerAccountIndex: 0,
    trader: core.paraswapTrader!.address,
    tradeData: encodedTradeData,
  };
}

export async function liquidateV4(
  core: CoreProtocol,
  solidAccountStruct: Account.InfoStruct,
  liquidAccountStruct: Account.InfoStruct,
  marketIdsPath: BigNumberish[],
  amountWeisPath: BigNumberish[],
  unwrapper: { address: address },
  unwrapperTradeData: string = BYTES_EMPTY,
  paraswapTraderParam: IGenericTraderProxyBase.TraderParamStruct | undefined = undefined,
  expiry: BigNumberish = NO_EXPIRY,
): Promise<ContractTransaction> {
  const defaultUnwrapperTraderParam: TraderParamStruct = {
    traderType: GenericTraderType.IsolationModeUnwrapper,
    makerAccountIndex: 0,
    trader: unwrapper.address,
    tradeData: unwrapperTradeData,
  };

  const tradersPath = [defaultUnwrapperTraderParam];
  if (paraswapTraderParam) {
    tradersPath.push(paraswapTraderParam);
  }

  return core.liquidatorProxyV4!.connect(core.hhUser5).liquidate(
    solidAccountStruct,
    liquidAccountStruct,
    marketIdsPath,
    amountWeisPath,
    tradersPath,
    [],
    expiry,
  );
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

export async function getCalldataForParaswap(
  inputAmount: BigNumber,
  inputToken: { address: address },
  inputDecimals: number,
  minOutputAmount: BigNumber,
  outputToken: { address: address },
  outputDecimals: number,
  txOrigin: { address: address },
  receiver: { address: address },
  core: CoreProtocol,
): Promise<{ calldata: string, outputAmount: BigNumber }> {
  const priceRouteResponse = await axios.get(`${API_URL}/prices`, {
    params: {
      network: core.config.network,
      srcToken: inputToken.address,
      srcDecimals: inputDecimals,
      destToken: outputToken.address,
      destDecimals: outputDecimals,
      amount: inputAmount.toString(),
      includeContractMethods: 'simpleSwap,multiSwap,megaSwap',
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
  const result = await axios.post(`${API_URL}/transactions/${core.config.network}?${queryParams}`, {
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
