import { address } from '@dolomite-exchange/dolomite-margin';
import { BigNumber as ZapBigNumber, ZapOutputParam } from '@dolomite-exchange/zap-sdk';
import { GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { AccountInfoStruct, GenericTraderParamStruct } from '../../src/utils';
import {
  BYTES_EMPTY,
  MAX_UINT_256_BI,
  Network,
  NO_EXPIRY,
  NO_PARASWAP_TRADER_PARAM,
  ONE_BI,
} from '../../src/utils/no-deps-constants';
import { CoreProtocolType } from './setup';
import { ZapParam } from './zap-utils';

export function toZapBigNumber(amount: BigNumberish): ZapBigNumber {
  return new ZapBigNumber(amount.toString());
}

export function getLastZapAmountToBigNumber(zapOutput: ZapOutputParam): BigNumber {
  return BigNumber.from(zapOutput.amountWeisPath[zapOutput.amountWeisPath.length - 1].toString());
}

export async function liquidateV4WithIsolationMode<T extends Network>(
  core: CoreProtocolType<T>,
  solidAccountStruct: AccountInfoStruct,
  liquidAccountStruct: AccountInfoStruct,
  marketIdsPath: BigNumberish[],
  unwrapper: { address: address },
  unwrapperTradeData: string = BYTES_EMPTY,
  paraswapTraderParam: GenericTraderParamStruct | undefined = NO_PARASWAP_TRADER_PARAM,
  expiry: BigNumberish = NO_EXPIRY,
): Promise<ContractTransaction> {
  const defaultUnwrapperTraderParam: GenericTraderParamStruct = {
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
    MAX_UINT_256_BI,
    MAX_UINT_256_BI,
    tradersPath,
    [],
    expiry,
  );
}

export async function liquidateV4WithLiquidityToken<T extends Network>(
  core: CoreProtocolType<T>,
  solidAccountStruct: AccountInfoStruct,
  liquidAccountStruct: AccountInfoStruct,
  marketIdsPath: BigNumberish[],
  amountWeisPath: BigNumberish[],
  unwrapper: { address: address },
  unwrapperTradeData: string = BYTES_EMPTY,
  paraswapTraderParam: GenericTraderParamStruct | undefined = NO_PARASWAP_TRADER_PARAM,
  expiry: BigNumberish = NO_EXPIRY,
): Promise<ContractTransaction> {
  const defaultUnwrapperTraderParam: GenericTraderParamStruct = {
    traderType: GenericTraderType.ExternalLiquidity,
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
    MAX_UINT_256_BI,
    MAX_UINT_256_BI,
    tradersPath,
    [],
    expiry,
  );
}

export async function liquidateV4WithZap<T extends Network>(
  core: CoreProtocolType<T>,
  solidAccountStruct: AccountInfoStruct,
  liquidAccountStruct: AccountInfoStruct,
  zapOutputs: ZapOutputParam[],
  expiry: BigNumberish = NO_EXPIRY,
): Promise<ContractTransaction> {
  let latestError = new Error('No zap output found');
  for (let i = 0; i < zapOutputs.length; i++) {
    const zapOutput = zapOutputs[i];
    try {
      return await core.liquidatorProxyV4!.connect(core.hhUser5).liquidate(
        solidAccountStruct,
        liquidAccountStruct,
        zapOutput.marketIdsPath.map(marketId => marketId.toString()),
        MAX_UINT_256_BI,
        MAX_UINT_256_BI,
        zapOutput.traderParams,
        zapOutput.makerAccounts,
        expiry,
      );
    } catch (e) {
      console.warn(`Failed to liquidate with zap at index ${i}. Trying next zap output...`, e);
      latestError = e as Error;
    }
  }

  return Promise.reject(latestError);
}

export async function liquidateV4WithZapParam<T extends Network>(
  core: CoreProtocolType<T>,
  solidAccountStruct: AccountInfoStruct,
  liquidAccountStruct: AccountInfoStruct,
  zapParam: ZapParam,
  expiry: BigNumberish = NO_EXPIRY,
): Promise<ContractTransaction> {
  return await core.liquidatorProxyV4!.connect(core.hhUser5).liquidate(
    solidAccountStruct,
    liquidAccountStruct,
    zapParam.marketIdsPath,
    MAX_UINT_256_BI,
    MAX_UINT_256_BI,
    zapParam.tradersPath,
    zapParam.makerAccounts,
    expiry,
  );
}
