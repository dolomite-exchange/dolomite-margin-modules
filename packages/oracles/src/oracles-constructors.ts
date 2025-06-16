import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolConfig, CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  AggregatorInfo,
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  CHAINLINK_PRICE_ORACLE_V1_MAP,
  CHAINSIGHT_ORACLE_ADDRESS_MAP,
  CHAINSIGHT_SENDER_ADDRESS_MAP,
} from 'packages/base/src/utils/constants';
import { ADDRESS_ZERO, DolomiteNetwork } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolPolygonZkEvm } from 'packages/base/test/utils/core-protocols/core-protocol-polygon-zkevm';
import { TokenInfo } from './index';
import {
  ChainlinkPriceOracleV3,
  ChainsightPriceOracleV3,
  ChroniclePriceOracleV3,
  IAlgebraV3Pool,
  IChainlinkAggregator,
  IChainlinkPriceOracleV1,
  IChainlinkPriceOracleV1__factory,
  IChainlinkPriceOracleV3,
  IChaosLabsPriceOracleV3,
  IDolomiteRegistry,
  IERC20Metadata__factory,
  IRedstonePriceOracleV2__factory,
  IVerifierProxy,
  OracleAggregatorV2,
  RedstonePriceOracleV3,
} from './types';

export type CoreProtocolWithChainlinkOld<T extends DolomiteNetwork> = Extract<
  CoreProtocolType<T>,
  {
    dolomiteMargin: DolomiteMargin<T>;
    chainlinkPriceOracleV1: IChainlinkPriceOracleV1;
  }
>;

export type CoreProtocolWithChainlinkV3<T extends DolomiteNetwork> = Extract<
  CoreProtocolType<T>,
  {
    dolomiteMargin: DolomiteMargin<T>;
    chainlinkPriceOracleV3: IChainlinkPriceOracleV3;
    oracleAggregatorV2: OracleAggregatorV2;
  }
>;

export type CoreProtocolWithChaosLabsV3<T extends DolomiteNetwork> = Extract<
  CoreProtocolType<T>,
  {
    dolomiteMargin: DolomiteMargin<T>;
    chaosLabsPriceOracleV3: IChaosLabsPriceOracleV3;
    oracleAggregatorV2: OracleAggregatorV2;
  }
>;

export type CoreProtocolWithChainsightV3<T extends DolomiteNetwork> = Extract<
  CoreProtocolType<T>,
  {
    config: CoreProtocolConfig<T>;
    dolomiteMargin: DolomiteMargin<T>;
    chainsightPriceOracleV3: ChainsightPriceOracleV3;
    oracleAggregatorV2: OracleAggregatorV2;
  }
>;

export type CoreProtocolWithChronicle<T extends DolomiteNetwork> = Extract<
  CoreProtocolType<T>,
  {
    config: CoreProtocolConfig<T>;
    dolomiteMargin: DolomiteMargin<T>;
    chroniclePriceOracleV3: ChroniclePriceOracleV3;
    oracleAggregatorV2: OracleAggregatorV2;
  }
>;

export type CoreProtocolWithRedstone<T extends DolomiteNetwork> = Extract<
  CoreProtocolType<T>,
  {
    config: CoreProtocolConfig<T>;
    dolomiteMargin: DolomiteMargin<T>;
    redstonePriceOracleV3: RedstonePriceOracleV3;
    oracleAggregatorV2: OracleAggregatorV2;
  }
>;

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
  const oldPriceOracle = IChainlinkPriceOracleV1__factory.connect(
    CHAINLINK_PRICE_ORACLE_V1_MAP[core.config.network],
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
      aggregators.push(await oldPriceOracle.getAggregatorByToken(token));
      tokenDecimals.push(await oldPriceOracle.getDecimalsByToken(token));
      tokenPairs.push(await oldPriceOracle.getTokenPairByToken(token));
    }
  }
  return [tokens, aggregators, tokenDecimals, tokenPairs, core.dolomiteMargin.address];
}

export function getChainlinkDataStreamsPriceOracleConstructorParams(
  core: CoreProtocolArbitrumOne,
  verifierProxy: IVerifierProxy,
  tokens: IERC20[],
  feeds: string[],
): any {
  return [
    core.tokens.link.address,
    verifierProxy.address,
    tokens.map((t) => t.address),
    feeds,
    core.dolomiteRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export function getChainsightPriceOracleV3ConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  tokens: string[],
  keys: string[],
  invertPrices: boolean[],
): any[] {
  return [
    CHAINSIGHT_ORACLE_ADDRESS_MAP[core.config.network],
    CHAINSIGHT_SENDER_ADDRESS_MAP[core.config.network],
    tokens,
    keys,
    invertPrices,
    core.dolomiteRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export async function getOracleAggregatorV2ConstructorParams(
  core: CoreProtocolArbitrumOne,
  chainlinkOracle: ChainlinkPriceOracleV3,
  redstoneOracle: RedstonePriceOracleV3,
  tokenToNewOracleMap: Record<string, AggregatorInfo[]>,
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
    [Deployments.JonesUSDCV1WithChainlinkAutomationPriceOracleV1[core.network].address]: true,
    [Deployments.MagicGLPWithChainlinkAutomationPriceOracleV1[core.network].address]: true,
    [Deployments.PendlePtGLPPriceOracle[core.network].address]: true,
    [Deployments.PendlePtWstEthJun2024PriceOracle[core.network].address]: true,
    [Deployments.PendlePtWstEthJun2025PriceOracle[core.network].address]: true,
    [Deployments.GmxV2MarketTokenPriceOracleV1[core.network].address]: true,
    [Deployments.PendleYtGLPPriceOracle[core.network].address]: true,
  };
  const tokensInfos: TokenInfo[] = [];
  const marketsLength = (await core.dolomiteMargin.getNumMarkets()).toNumber();
  const chainlinkPriceAggregatorMap = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network];
  const allChainlinkTokens = Object.keys(chainlinkPriceAggregatorMap);
  const extraTokenInfos: TokenInfo[] = [];
  for (let i = 0; i < allChainlinkTokens.length; i++) {
    try {
      // Extra tokens are ones that are not listed on Dolomite but need to be present in the oracle
      await core.dolomiteMargin.getMarketIdByTokenAddress(allChainlinkTokens[i]);
    } catch (e) {
      console.log('\tAdding extra token ', allChainlinkTokens[i]);
      extraTokenInfos.push({
        token: allChainlinkTokens[i],
        decimals: 18,
        oracleInfos: [
          {
            oracle: chainlinkOracle.address,
            tokenPair: chainlinkPriceAggregatorMap[allChainlinkTokens[i]]!.tokenPairAddress ?? ADDRESS_ZERO,
            weight: 100,
          },
        ],
      });
    }
  }

  for (let i = 0; i < marketsLength; i++) {
    const token = await core.dolomiteMargin.getMarketTokenAddress(i);
    const oldOracleAddress = await core.dolomiteMargin.getMarketPriceOracle(i);

    if (oldOracleAddress === oldChainlinkPriceOracle.address) {
      tokensInfos.push({
        token,
        decimals: await oldChainlinkPriceOracle.getDecimalsByToken(token),
        oracleInfos: [
          {
            oracle: chainlinkOracle.address,
            tokenPair: await oldChainlinkPriceOracle.getTokenPairByToken(token),
            weight: 100,
          },
        ],
      });
    } else if (oldOracleAddress === oldRedstonePriceOracle.address) {
      tokensInfos.push({
        token,
        decimals: await oldRedstonePriceOracle.getDecimalsByToken(token),
        oracleInfos: [
          {
            oracle: redstoneOracle.address,
            tokenPair: await oldRedstonePriceOracle.getTokenPairByToken(token),
            weight: 100,
          },
        ],
      });
    } else if (reusableOracles[oldOracleAddress]) {
      tokensInfos.push({
        token,
        decimals: 18,
        oracleInfos: [
          {
            oracle: oldOracleAddress,
            tokenPair: ADDRESS_ZERO,
            weight: 100,
          },
        ],
      });
    } else if (!!tokenToNewOracleMap[token]) {
      tokensInfos.push({
        token,
        decimals: await IERC20Metadata__factory.connect(token, core.hhUser1).decimals(),
        oracleInfos: tokenToNewOracleMap[token].map((aggregator, _, list) => ({
          oracle: aggregator.aggregatorAddress,
          tokenPair: aggregator.tokenPairAddress ?? ADDRESS_ZERO,
          weight: BigNumber.from(100).div(list.length).toNumber(),
        })),
      });
    } else {
      assertHardhatInvariant(false, `Invalid old oracle, found ${oldOracleAddress}`);
    }
  }

  return [tokensInfos.concat(extraTokenInfos), core.dolomiteMargin.address];
}

export function getChainlinkPriceOracleV3ConstructorParams<T extends DolomiteNetwork>(
  tokens: IERC20[],
  aggregators: IChainlinkAggregator[],
  invertPrices: boolean[],
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteMargin: DolomiteMargin<T>,
): [string[], string[], boolean[], string, string] {
  return [
    tokens.map((t) => t.address),
    aggregators.map((t) => t.address),
    invertPrices,
    dolomiteRegistry.address,
    dolomiteMargin.address,
  ];
}

export function getChaosLabsPriceOracleV3ConstructorParams<T extends DolomiteNetwork>(
  tokens: IERC20[],
  aggregators: IChainlinkAggregator[],
  invertPrices: boolean[],
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteMargin: DolomiteMargin<T>,
): [string[], string[], boolean[], string, string] {
  return [
    tokens.map((t) => t.address),
    aggregators.map((t) => t.address),
    invertPrices,
    dolomiteRegistry.address,
    dolomiteMargin.address,
  ];
}

export function getChroniclePriceOracleV3ConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  tokens: string[],
  scribes: string[],
  invertPrices: boolean[],
): [string[], string[], boolean[], string, string] {
  return [tokens, scribes, invertPrices, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export function getRamsesCLPriceOracleV3ConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  token: IERC20,
  pool: string,
): any[] {
  return [token.address, pool, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export async function getRedstonePriceOracleV2ConstructorParams<T extends DolomiteNetwork>(
  tokens: IERC20[],
  aggregators: string[],
  tokenPairs: string[],
  bypassUsdValue: boolean[],
  core: CoreProtocolType<T>,
): Promise<[string[], string[], BigNumberish[], string[], boolean[], string]> {
  return [
    tokens.map((t) => t.address),
    aggregators,
    await Promise.all(tokens.map((t) => IERC20Metadata__factory.connect(t.address, t.signer).decimals())),
    tokenPairs,
    bypassUsdValue,
    core.dolomiteMargin.address,
  ];
}

export function getRedstonePriceOracleV3ConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  tokens: string[],
  redstoneAggregators: string[],
  invertPrices: boolean[],
): [string[], string[], boolean[], string, string] {
  return [tokens, redstoneAggregators, invertPrices, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export function getTWAPPriceOracleV1ConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  token: IERC20,
  tokenPairs: IAlgebraV3Pool[],
): any[] {
  return [token.address, tokenPairs.map((pair) => pair.address), core.dolomiteMargin.address];
}

export function getTWAPPriceOracleV2ConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  token: IERC20,
  tokenPair: IAlgebraV3Pool,
): any[] {
  return [token.address, tokenPair.address, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}
