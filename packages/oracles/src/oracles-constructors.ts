import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  CoreProtocolArbitrumOne,
  CoreProtocolPolygonZkEvm,
} from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { AggregatorInfo, CHAINLINK_PRICE_ORACLE_OLD_MAP } from 'packages/base/src/utils/constants';
import { ADDRESS_ZERO, Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { TokenInfo } from './index';
import {
  ChainlinkPriceOracleV3,
  IAlgebraV3Pool,
  IChainlinkAggregator,
  IChainlinkPriceOracleOld,
  IChainlinkPriceOracleOld__factory,
  IChainlinkPriceOracleV1__factory,
  IDolomiteRegistry,
  IERC20Metadata__factory,
  IRedstonePriceOracleV2__factory,
  RedstonePriceOracleV3,
} from './types';

export type CoreProtocolWithChainlink<T extends Network> = Extract<CoreProtocolType<T>, {
  dolomiteMargin: DolomiteMargin<T>;
  chainlinkPriceOracleOld: IChainlinkPriceOracleOld;
}>;

export async function getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1ZkEvm(
  core: CoreProtocolPolygonZkEvm,
): Promise<[string[], string[], boolean[], string, string]> {
  const oldPriceOracle = IChainlinkPriceOracleV1__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );
  const tokens: string[] = [];
  const aggregators: string[] = [];
  const invertPrice: boolean[] = [];

  const filter = oldPriceOracle.filters.TokenInsertedOrUpdated();
  let results = await oldPriceOracle.queryFilter(filter, 9792982, 9792983);
  results = results.concat(await oldPriceOracle.queryFilter(filter, 9859954, 9859954));
  results = results.concat(await oldPriceOracle.queryFilter(filter, 9893094, 9893094));

  for (let i = 0; i < results.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], results[i].topics[1])[0];
    tokens.push(token);
    aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
    invertPrice.push(false);
  }
  return [tokens, aggregators, invertPrice, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export async function getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1(
  core: CoreProtocolArbitrumOne,
): Promise<[string[], string[], boolean[], string, string]> {
  const oldPriceOracle = IChainlinkPriceOracleV1__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );
  const tokens: string[] = [];
  const aggregators: string[] = [];
  const invertPrices: boolean[] = [];

  const filter = oldPriceOracle.filters.TokenInsertedOrUpdated();
  const results = await oldPriceOracle.queryFilter(filter);
  let seenWstEth = false;

  for (let i = 0; i < results.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], results[i].topics[1])[0];
    if (token !== core.tokens.wstEth.address) {
      tokens.push(token);
      aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
      invertPrices.push(false);
    } else {
      // We only want to push the second instance of seeing wstETH
      if (seenWstEth) {
        tokens.push(token);
        aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
        invertPrices.push(false);
      }
      seenWstEth = true;
    }
  }
  return [tokens, aggregators, invertPrices, core.dolomiteRegistry.address, core.dolomiteMargin.address];
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

export async function getOracleAggregatorV1ConstructorParams(
  core: CoreProtocolArbitrumOne | CoreProtocolPolygonZkEvm,
  chainlinkOracle: ChainlinkPriceOracleV3,
  redstoneOracle: RedstonePriceOracleV3 | null,
): Promise<[string[], string[], string[], string]> {
  const oldPriceOracle = IChainlinkPriceOracleV1__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );

  const tokens: string[] = [];
  const oracles: string[] = [];
  const tokenPairs: string[] = [];

  const chainlinkFilter = chainlinkOracle.filters.TokenInsertedOrUpdated();
  let chainlinkResults;
  if (core.config.network === Network.ArbitrumOne) {
    chainlinkResults = await chainlinkOracle.queryFilter(chainlinkFilter);
  } else {
    chainlinkResults = await chainlinkOracle.queryFilter(chainlinkFilter, -9999);
  }
  for (let i = 0; i < chainlinkResults.length; i++) {
    const token = ethers.utils.defaultAbiCoder.decode(['address'], chainlinkResults[i].topics[1])[0];
    tokens.push(token);
    oracles.push(chainlinkOracle.address);
    tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
  }

  if (redstoneOracle) {
    const redstoneFilter = redstoneOracle.filters.TokenInsertedOrUpdated();
    const redstoneResults = await redstoneOracle.queryFilter(redstoneFilter);
    for (let i = 0; i < redstoneResults.length; i++) {
      const token = ethers.utils.defaultAbiCoder.decode(['address'], redstoneResults[i].topics[1])[0];
      tokens.push(token);
      oracles.push(redstoneOracle.address);
      // @follow-up Right now weEth is the only token so hardcoding weth as token pair
      tokenPairs.push(core.tokens.weth.address);
    }
  }

  return [tokens, oracles, tokenPairs, core.dolomiteMargin.address];
}

export async function getOracleAggregatorV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  chainlinkOracle: ChainlinkPriceOracleV3,
  redstoneOracle: RedstonePriceOracleV3,
  tokenToNewOracleMap: Record<string, AggregatorInfo>,
): Promise<[TokenInfo[], string]> {
  const oldChainlinkPriceOracle = IChainlinkPriceOracleV1__factory.connect(
    Deployments.ChainlinkPriceOracleV1[core.config.network].address,
    core.hhUser1,
  );
  const oldRedstonePriceOracle = IRedstonePriceOracleV2__factory.connect(
    Deployments.RedstonePriceOracleV1[core.config.network].address,
    core.hhUser1,
  );

  const reusableOracles = {
    [Deployments.PlutusVaultGLPWithChainlinkAutomationPriceOracleV3[core.network].address]: true,
    [Deployments.GLPPriceOracleV1[core.network].address]: true,
    [Deployments.JonesUSDCWithChainlinkAutomationPriceOracleV1[core.network].address]: true,
    [Deployments.MagicGLPWithChainlinkAutomationPriceOracle[core.network].address]: true,
    [Deployments.PendlePtGLPPriceOracle[core.network].address]: true,
    [Deployments.PendlePtWstEthJun2024PriceOracle[core.network].address]: true,
    [Deployments.PendlePtWstEthJun2025PriceOracle[core.network].address]: true,
    [Deployments.GmxV2MarketTokenPriceOracleV1[core.network].address]: true,
  };
  const tokensInfos: TokenInfo[] = [];
  const marketsLength = (await core.dolomiteMargin.getNumMarkets()).toNumber();

  for (let i = 0; i < marketsLength; i++) {
    const token = await core.dolomiteMargin.getMarketTokenAddress(i);
    const oldOracleAddress = await core.dolomiteMargin.getMarketPriceOracle(i);

    let decimals: number;
    let tokenPair: string;
    let oracle: string;
    if (oldOracleAddress === oldChainlinkPriceOracle.address) {
      decimals = await oldChainlinkPriceOracle.getDecimalsByToken(token);
      tokenPair = await oldChainlinkPriceOracle.getTokenPairByToken(token);
      oracle = chainlinkOracle.address;
    } else if (oldOracleAddress === oldRedstonePriceOracle?.address) {
      decimals = await oldRedstonePriceOracle?.getDecimalsByToken(token);
      tokenPair = await oldRedstonePriceOracle?.getTokenPairByToken(token);
      oracle = redstoneOracle.address;
    } else if (reusableOracles[oldOracleAddress]) {
      decimals = 18;
      tokenPair = ADDRESS_ZERO;
      oracle = oldOracleAddress;
    } else if (!!tokenToNewOracleMap[token]) {
      decimals = await IERC20Metadata__factory.connect(token, core.hhUser1).decimals();
      tokenPair = tokenToNewOracleMap[token].tokenPairAddress ?? ADDRESS_ZERO;
      oracle = tokenToNewOracleMap[token].aggregatorAddress;
    } else {
      assertHardhatInvariant(false, `Invalid old oracle, found ${oldOracleAddress}`);
    }

    tokensInfos.push({
      token,
      decimals,
      oracleInfos: [
        {
          oracle,
          tokenPair,
          weight: 100,
        },
      ],
    });
  }

  return [tokensInfos, core.dolomiteMargin.address];
}

export async function getChainlinkPriceOracleV1ConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: IChainlinkAggregator[],
  tokenPairs: IERC20[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], string[], string]> {
  return [
    tokens.map(t => t.address),
    aggregators.map(t => t.address),
    await Promise.all(tokens.map(t => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    tokenPairs.map(t => t.address),
    core.dolomiteMargin.address,
  ];
}

export function getChainlinkPriceOracleV3ConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  aggregators: IChainlinkAggregator[],
  invertPrices: boolean[],
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteMargin: DolomiteMargin<T>,
): [string[], string[], boolean[], string, string] {
  return [
    tokens.map(t => t.address),
    aggregators.map(t => t.address),
    invertPrices,
    dolomiteRegistry.address,
    dolomiteMargin.address,
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

export function getRedstonePriceOracleV3ConstructorParams<T extends NetworkType>(
  tokens: IERC20[],
  redstoneAggregators: IChainlinkAggregator[],
  invertPrice: boolean[],
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteMargin: DolomiteMargin<T>,
): [string[], string[], boolean[], string, string] {
  return [
    tokens.map(t => t.address),
    redstoneAggregators.map(r => r.address),
    invertPrice,
    dolomiteRegistry.address,
    dolomiteMargin.address,
  ];
}

export function getTWAPPriceOracleV1ConstructorParams<T extends Network>(
  core: CoreProtocolType<T>,
  token: IERC20,
  tokenPairs: IAlgebraV3Pool[],
): any[] {
  return [token.address, tokenPairs.map(pair => pair.address), core.dolomiteMargin.address];
}

export function getTWAPPriceOracleV2ConstructorParams<T extends Network>(
  core: CoreProtocolType<T>,
  token: IERC20,
  tokenPair: IAlgebraV3Pool,
): any[] {
  return [token.address, tokenPair.address, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}
