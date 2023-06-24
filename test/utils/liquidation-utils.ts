import { address } from '@dolomite-exchange/dolomite-margin';
import { ZapOutputParam } from '@dolomite-exchange/zap-sdk/dist';
import { GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import axios from 'axios';
import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import { Account } from '../../src/types/IDolomiteMargin';
import { IGenericTraderProxyBase } from '../../src/types/LiquidatorProxyV4WithGenericTrader';
import { NO_EXPIRY } from '../../src/utils/no-deps-constants';
import { expectThrow } from './assertions';
import { CoreProtocol } from './setup';

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

export async function liquidateV4WithIsolationMode(
  core: CoreProtocol,
  solidAccountStruct: Account.InfoStruct,
  liquidAccountStruct: Account.InfoStruct,
  zapOutput: ZapOutputParam,
  expiry: BigNumberish = NO_EXPIRY,
): Promise<ContractTransaction> {
  const amountWeisPath = zapOutput.amountWeisPath.map((amount, i) => {
    if (i === zapOutput.amountWeisPath.length - 1) {
      return ethers.constants.MaxUint256.toString();
    }
    if (i === 0) {
      return ethers.constants.MaxUint256.toString();
    }
    return amount.toString();
  });
  return core.liquidatorProxyV4!.connect(core.hhUser5).liquidate(
    solidAccountStruct,
    liquidAccountStruct,
    zapOutput.marketIdsPath,
    amountWeisPath,
    zapOutput.traderParams,
    zapOutput.makerAccounts,
    expiry,
  );
}

export async function checkForParaswapSuccess(
  contractTransactionPromise: Promise<ContractTransaction>,
): Promise<boolean> {
  // 489388144448000000000000000000000000
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
