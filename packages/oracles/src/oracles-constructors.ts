import { IAlgebraV3Pool, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import { CHAINLINK_PRICE_ORACLE_OLD_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { ADDRESS_ZERO, Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import {
  IChainlinkAggregator,
  IChainlinkPriceOracle,
  IChainlinkPriceOracleOld__factory,
  IERC20Metadata, IERC20Metadata__factory,
} from './types';

export type CoreProtocolWithChainlink<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  chainlinkPriceOracle: IChainlinkPriceOracle;
}>;

export async function getChainlinkPriceOracleConstructorParamsFromOldPriceOracle(
  core: CoreProtocolArbitrumOne,
): Promise<[string[], string[], BigNumberish[], string[], string]> {
  const oldPriceOracle = IChainlinkPriceOracleOld__factory.connect(
    CHAINLINK_PRICE_ORACLE_OLD_MAP[core.config.network],
    core.hhUser1,
  );
  const tokens: string[] = [];
  const aggregators: string[] = [];
  const tokenDecimals: number[] = [];
  const tokenPairs: string[] = [];
  const marketsLength = (await core.dolomiteMargin.getNumMarkets()).toNumber();
  for (let i = 0; i < marketsLength; i++) {
    const token = await core.dolomiteMargin.getMarketTokenAddress(i);
    const priceOracle = await core.dolomiteMargin.getMarketPriceOracle(i);
    if (priceOracle === oldPriceOracle.address) {
      tokens.push(token);
      aggregators.push(await oldPriceOracle.tokenToAggregatorMap(token));
      tokenDecimals.push(await oldPriceOracle.tokenToDecimalsMap(token));
      tokenPairs.push(await oldPriceOracle.tokenToPairingMap(token));
    }
  }
  return [tokens, aggregators, tokenDecimals, tokenPairs, core.dolomiteMargin.address];
}

export async function getChainlinkPriceOracleConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: IChainlinkAggregator[],
  tokenPairs: IERC20[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], string[], string]> {
  const tokenDecimals: number[] = [];
  return [
    tokens.map(t => t.address),
    aggregators.map(t => t.address),
    await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    tokenPairs.map(t => t.address),
    core.dolomiteMargin.address,
  ];
}

export async function getRedstonePriceOracleConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: string[],
  tokenPairs: string[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], string[], string]> {
  return [
    tokens.map(t => t.address),
    aggregators,
    await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    tokenPairs,
    core.dolomiteMargin.address,
  ];
}

export function getTWAPPriceOracleConstructorParams<T extends Network>(
  core: CoreProtocolType<T>,
  token: IERC20,
  tokenPairs: IAlgebraV3Pool[],
): any[] {
  return [token.address, tokenPairs.map(pair => pair.address), core.dolomiteMargin.address];
}
