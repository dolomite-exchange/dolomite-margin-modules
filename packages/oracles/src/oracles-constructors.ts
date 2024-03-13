import { IAlgebraV3Pool, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import {
  ChainlinkPriceOracleV2,
  IChainlinkAggregator,
  IChainlinkPriceOracleOld,
  IChainlinkPriceOracleOld__factory,
  IERC20Metadata__factory,
  RedstonePriceOracle,
} from './types';
import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { ethers } from 'hardhat';

export type CoreProtocolWithChainlink<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  chainlinkPriceOracle: IChainlinkPriceOracleOld;
}>;

export async function getChainlinkPriceOracleConstructorParamsFromOldPriceOracle(
  core: CoreProtocolArbitrumOne,
): Promise<[string[], string[], BigNumberish[], string[], string]> {
  const oldPriceOracle = IChainlinkPriceOracleOld__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );
  const tokens: string[] = [];
  const aggregators: string[] = [];
  const tokenDecimals: number[] = [];
  const tokenPairs: string[] = [];

  const filter = oldPriceOracle.filters.TokenInsertedOrUpdated();
  const results = await oldPriceOracle.queryFilter(filter);
  let seenWstEth = false;

  for (let i = 0; i < results.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], results[i].topics[1])[0];
    if (token !== core.tokens.wstEth.address) {
      tokens.push(token);
      aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
      tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
      tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
    } else {
      if (seenWstEth) {
        tokens.push(token);
        aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
        tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
        tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
      }
      seenWstEth = true;
    }
  }
  return [tokens, aggregators, tokenDecimals, tokenPairs, core.dolomiteMargin.address];
}

export async function getOracleAggregatorConstructorParams(
  core: CoreProtocolArbitrumOne,
  chainlinkOracle: ChainlinkPriceOracleV2,
  redstoneOracle: RedstonePriceOracle
): Promise<[string[], string[], string]> {
  const tokens: string[] = [];
  const oracles: string[] = [];

  const chainlinkFilter = chainlinkOracle.filters.TokenInsertedOrUpdated();
  const chainlinkResults = await chainlinkOracle.queryFilter(chainlinkFilter);
  for (let i = 0; i < chainlinkResults.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], chainlinkResults[i].topics[1])[0];
    tokens.push(token);
    oracles.push(chainlinkOracle.address);
  }

  const redstoneFilter = redstoneOracle.filters.TokenInsertedOrUpdated();
  const redstoneResults = await redstoneOracle.queryFilter(redstoneFilter);
  for (let i = 0; i < redstoneResults.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], redstoneResults[i].topics[1])[0];
    tokens.push(token);
    oracles.push(redstoneOracle.address);
  }

  return [tokens, oracles, core.dolomiteMargin.address];
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
