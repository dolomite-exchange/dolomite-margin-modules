import { IAlgebraV3Pool, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import {
  ChainlinkPriceOracleV3,
  IChainlinkAggregator,
  IChainlinkPriceOracleOld,
  IChainlinkPriceOracleOld__factory,
  IChainlinkPriceOracleV1__factory,
  IERC20Metadata__factory,
  RedstonePriceOracleV2,
  RedstonePriceOracleV3,
} from './types';
import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { ethers } from 'hardhat';
import { CHAINLINK_PRICE_ORACLE_OLD_MAP } from 'packages/base/src/utils/constants';

export type CoreProtocolWithChainlink<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  chainlinkPriceOracle: IChainlinkPriceOracleOld;
}>;

export async function getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1(
  core: CoreProtocolArbitrumOne,
): Promise<[string[], string[], BigNumberish[], boolean[], string]> {
  const oldPriceOracle = IChainlinkPriceOracleV1__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );
  const tokens: string[] = [];
  const aggregators: string[] = [];
  const tokenDecimals: number[] = [];
  const invertPrice: boolean[] = [];

  const filter = oldPriceOracle.filters.TokenInsertedOrUpdated();
  const results = await oldPriceOracle.queryFilter(filter);
  let seenWstEth = false;

  for (let i = 0; i < results.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], results[i].topics[1])[0];
    if (token !== core.tokens.wstEth.address) {
      tokens.push(token);
      aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
      tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
      invertPrice.push(false);
    } else {
      if (seenWstEth) {
        tokens.push(token);
        aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
        tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
        invertPrice.push(false);
      }
      seenWstEth = true;
    }
  }
  return [tokens, aggregators, tokenDecimals, invertPrice, core.dolomiteMargin.address];
}

export async function getChainlinkPriceOracleV2ConstructorParamsFromOldPriceOracle(
  core: CoreProtocolArbitrumOne,
): Promise<[string[], string[], BigNumberish[], string[], boolean[], string]> {
  const oldPriceOracle = IChainlinkPriceOracleV1__factory.connect(
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
  let seenWstEth = false;

  for (let i = 0; i < results.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], results[i].topics[1])[0];
    if (token !== core.tokens.wstEth.address) {
      tokens.push(token);
      aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
      tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
      tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
      bypassUsdValue.push(false);
    } else {
      if (seenWstEth) {
        tokens.push(token);
        aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
        tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
        tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
        bypassUsdValue.push(false);
      }
      seenWstEth = true;
    }
  }
  return [tokens, aggregators, tokenDecimals, tokenPairs, bypassUsdValue, core.dolomiteMargin.address];
}

export async function getChainlinkPriceOracleV1ConstructorParamsFromOldPriceOracle(
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

export async function getOracleAggregatorConstructorParams(
  core: CoreProtocolArbitrumOne,
  chainlinkOracle: ChainlinkPriceOracleV3,
  redstoneOracle: RedstonePriceOracleV3
): Promise<[string[], string[], string[], string]> {
  const oldPriceOracle = IChainlinkPriceOracleV1__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );

  const tokens: string[] = [];
  const oracles: string[] = [];
  const tokenPairs: string[] = [];

  const chainlinkFilter = chainlinkOracle.filters.TokenInsertedOrUpdated();
  const chainlinkResults = await chainlinkOracle.queryFilter(chainlinkFilter);
  for (let i = 0; i < chainlinkResults.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], chainlinkResults[i].topics[1])[0];
    tokens.push(token);
    oracles.push(chainlinkOracle.address);
    tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
  }

  const redstoneFilter = redstoneOracle.filters.TokenInsertedOrUpdated();
  const redstoneResults = await redstoneOracle.queryFilter(redstoneFilter);
  for (let i = 0; i < redstoneResults.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], redstoneResults[i].topics[1])[0];
    tokens.push(token);
    oracles.push(redstoneOracle.address);
    // @follow-up Right now weEth is the only token so hardcoding weth as token pair
    tokenPairs.push(core.tokens.weth.address);
  }

  return [tokens, oracles, tokenPairs, core.dolomiteMargin.address];
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

export async function getRedstonePriceOracleV2ConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: string[],
  tokenPairs: string[],
  bypassUsdValue: boolean[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], string[], boolean[], string]> {
  return [
    tokens.map(t => t.address),
    aggregators,
    await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    tokenPairs,
    bypassUsdValue,
    core.dolomiteMargin.address,
  ];
}

export async function getRedstonePriceOracleV3ConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: string[],
  invertPrice: boolean[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], boolean[], string]> {
  return [
    tokens.map(t => t.address),
    aggregators,
    await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    invertPrice,
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
