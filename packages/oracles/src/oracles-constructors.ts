import { IAlgebraV3Pool, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import {
  IChainlinkAggregator,
  IChainlinkPriceOracleOld,
  IChainlinkPriceOracleOld__factory,
  IERC20Metadata__factory,
} from './types';
import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { ethers } from 'hardhat';

export type CoreProtocolWithChainlink<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  chainlinkPriceOracle: IChainlinkPriceOracleOld;
}>;

export async function getChainlinkPriceOracleConstructorParamsFromOldPriceOracle(
  core: CoreProtocolArbitrumOne,
): Promise<[string[], string[], BigNumberish[], string[], boolean[], string]> {
  const oldPriceOracle = IChainlinkPriceOracleOld__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );
  const tokens: string[] = [];
  const aggregators: string[] = [];
  const tokenDecimals: number[] = [];
  const tokenPairs: string[] = [];
  const bypassUsdValue: boolean[] = [];

  const filter = oldPriceOracle.filters.TokenInsertedOrUpdated();
  const results = await oldPriceOracle.queryFilter(filter);
  for (let i = 0; i < results.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], results[i].topics[1])[0];
    tokens.push(token);
    aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
    tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
    tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
    bypassUsdValue.push(false);
  }
  // Remove '0x5979d7b546e38e414f7e9822514be443a4800529' the first time it exists
  tokens.splice(9);
  aggregators.splice(9);
  tokenDecimals.splice(9);
  tokenPairs.splice(9);
  bypassUsdValue.splice(9);
  return [tokens, aggregators, tokenDecimals, tokenPairs, bypassUsdValue, core.dolomiteMargin.address];
}

export async function getChainlinkPriceOracleConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: IChainlinkAggregator[],
  tokenPairs: IERC20[],
  bypassUsdValue: boolean[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], string[], boolean[], string]> {
  return [
    tokens.map(t => t.address),
    aggregators.map(t => t.address),
    await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    tokenPairs.map(t => t.address),
    bypassUsdValue,
    core.dolomiteMargin.address,
  ];
}

export async function getRedstonePriceOracleConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: string[],
  tokenPairs: string[],
  tokenToBypassUsdValue: boolean[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], string[], boolean[], string]> {
  return [
    tokens.map(t => t.address),
    aggregators,
    await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    tokenPairs,
    tokenToBypassUsdValue,
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
