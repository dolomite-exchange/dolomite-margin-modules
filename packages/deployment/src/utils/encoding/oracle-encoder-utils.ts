import { BigNumberish } from 'ethers';
import { network } from 'hardhat';
import {
  CoreProtocolWithChainlinkOld,
  CoreProtocolWithChainlinkV3,
  CoreProtocolWithChaosLabsV3,
  CoreProtocolWithChronicle,
  CoreProtocolWithRedstone,
} from 'packages/oracles/src/oracles-constructors';
import { IChainlinkAggregator__factory, IChronicleScribe__factory } from 'packages/oracles/src/types';
import { IERC20, IERC20Metadata__factory, TestPriceOracleForAdmin__factory } from '../../../../base/src/types';
import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  CHAOS_LABS_PRICE_AGGREGATORS_MAP,
  CHRONICLE_PRICE_SCRIBES_MAP,
  INVALID_TOKEN_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '../../../../base/src/utils/constants';
import { ADDRESS_ZERO, Network, NetworkType, ONE_BI, ZERO_BI } from '../../../../base/src/utils/no-deps-constants';
import { impersonate } from '../../../../base/test/utils';
import { CoreProtocolBerachain } from '../../../../base/test/utils/core-protocols/core-protocol-berachain';
import { CoreProtocolXLayer } from '../../../../base/test/utils/core-protocols/core-protocol-x-layer';
import { CoreProtocolType } from '../../../../base/test/utils/setup';
import ModuleDeployments from '../../deploy/deployments.json';
import { PendlePtSystem } from '../deploy-utils';
import { EncodedTransaction } from '../dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety, setMostRecentTokenDecimals } from './base-encoder-utils';
import { encodeSetIsCollateralOnly, encodeSetSupplyCap } from './dolomite-margin-core-encoder-utils';

export async function encodeTestOracleAndDisableSupply(
  core: CoreProtocolBerachain,
  token: IERC20,
  price: BigNumberish,
): Promise<EncodedTransaction[]> {
  const testPriceOracle = TestPriceOracleForAdmin__factory.connect(
    ModuleDeployments.TestPriceOracleForAdmin[core.network].address,
    core.hhUser1,
  );
  const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token.address);

  return [
    await encodeSetSupplyCap(core, marketId, ONE_BI),
    await encodeSetIsCollateralOnly(core, marketId, true),
    await prettyPrintEncodedDataWithTypeSafety(core, { testPriceOracle }, 'testPriceOracle', 'setPrice', [
      token.address,
      price,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: testPriceOracle.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function encodeInsertChainlinkOracle<T extends NetworkType>(
  core: CoreProtocolWithChainlinkOld<T>,
  token: IERC20,
  tokenPairAddress: string | undefined = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.tokenPairAddress,
  aggregatorAddress: string = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
  options?: { ignoreDescription: boolean },
): Promise<EncodedTransaction> {
  const invalidTokens = ['stEth', 'eEth'];
  let tokenDecimals: number;
  if (invalidTokens.some((t) => t in core.tokens && token.address === (core.tokens as any)[t].address)) {
    tokenDecimals = 18;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = (await aggregator.description()).toLowerCase();
  const symbol = (await IERC20Metadata__factory.connect(token.address, token.signer).symbol()).toLowerCase();
  if (!options?.ignoreDescription) {
    if (!description.includes(symbol) && !description.includes(symbol.substring(1))) {
      return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
    }
  }

  setMostRecentTokenDecimals(tokenDecimals);
  return await prettyPrintEncodedDataWithTypeSafety(
    core,
    { chainlinkPriceOracle: core.chainlinkPriceOracleV1 },
    'chainlinkPriceOracle',
    'ownerInsertOrUpdateOracleToken',
    [token.address, tokenDecimals, aggregator.address, tokenPairAddress ?? ADDRESS_ZERO],
  );
}

export async function encodeInsertChainlinkOracleV3<T extends NetworkType>(
  core: CoreProtocolWithChainlinkV3<T>,
  token: IERC20,
  invertPrice: boolean = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.invert ?? false,
  tokenPairAddress: string | undefined = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.tokenPairAddress,
  aggregatorAddress: string = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
  options?: { ignoreDescription: boolean },
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = await aggregator.description();
  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  if (!options?.ignoreDescription) {
    if (
      !description.toUpperCase().includes(symbol.toUpperCase()) &&
      !description.toUpperCase().includes(symbol.toUpperCase().substring(1))
    ) {
      return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
    }
  }

  setMostRecentTokenDecimals(tokenDecimals);
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chainlinkPriceOracle: core.chainlinkPriceOracleV3 },
      'chainlinkPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.chainlinkPriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function encodeInsertChaosLabsOracleV3<T extends NetworkType>(
  core: CoreProtocolWithChaosLabsV3<T>,
  token: IERC20,
  invertPrice: boolean = CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][token.address]?.invert ?? false,
  tokenPairAddress: string | undefined = CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][token.address]
    ?.tokenPairAddress,
  aggregatorAddress: string = CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
  options?: { ignoreDescription: boolean },
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = await aggregator.description();
  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  if (!options?.ignoreDescription) {
    if (
      !description.toUpperCase().includes(symbol.toUpperCase()) &&
      !description.toUpperCase().includes(symbol.toUpperCase().substring(1))
    ) {
      return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
    }
  }

  setMostRecentTokenDecimals(tokenDecimals);
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chaosLabsPriceOracle: core.chaosLabsPriceOracleV3 },
      'chaosLabsPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.chaosLabsPriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function encodeInsertChronicleOracleV3(
  core: CoreProtocolWithChronicle<Network.ArbitrumOne | Network.Berachain | Network.Mantle>,
  token: IERC20,
  invertPrice: boolean = CHRONICLE_PRICE_SCRIBES_MAP[core.config.network][token.address].invertPrice ?? false,
  tokenPairAddress: string | undefined = CHRONICLE_PRICE_SCRIBES_MAP[core.config.network][token.address]
    .tokenPairAddress,
  scribeAddress: string = CHRONICLE_PRICE_SCRIBES_MAP[core.config.network][token.address].scribeAddress,
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const scribe = IChronicleScribe__factory.connect(scribeAddress, core.governance);

  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  const oracleAddress = core.chroniclePriceOracleV3.address;
  if ((await scribe.bud(oracleAddress)).eq(ZERO_BI)) {
    console.warn(`ChroniclePriceOracleV3 has not been kissed yet for scribe ${scribe.address}!`);
  }

  if (network.name === 'hardhat') {
    const toller = await impersonate((await scribe.authed())[0], true);
    const oracle = await impersonate(oracleAddress, true);
    await scribe.connect(toller).kiss(oracle.address);
    console.log(`\tChronicle price for ${symbol}:`, (await scribe.connect(oracle).latestRoundData()).answer.toString());
  }

  setMostRecentTokenDecimals(tokenDecimals);
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chroniclePriceOracle: core.chroniclePriceOracleV3 },
      'chroniclePriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, scribe.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.chroniclePriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function encodeInsertOkxOracleV3(
  core: CoreProtocolXLayer,
  token: IERC20,
  invertPrice: boolean,
  tokenPairAddress: string | undefined = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.tokenPairAddress,
  aggregatorAddress: string = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
): Promise<EncodedTransaction[]> {
  const invalidTokenMap: Record<Network.XLayer, Record<string, { symbol: string; decimals: number }>> = {
    [Network.XLayer]: {},
  };
  const invalidTokenSettings = invalidTokenMap[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = await aggregator.description();
  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  if (
    !description.toUpperCase().includes(symbol.toUpperCase()) &&
    !description.toUpperCase().includes(symbol.toUpperCase().substring(1))
  ) {
    return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
  }

  setMostRecentTokenDecimals(tokenDecimals);
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { okxPriceOracle: core.okxPriceOracleV3 },
      'okxPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.okxPriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function encodeInsertPendlePtOracle<T extends NetworkType>(
  core: CoreProtocolType<T>,
  pendleSystem: PendlePtSystem,
  token: IERC20,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { oracleAggregatorV2: core.oracleAggregatorV2 },
    'oracleAggregatorV2',
    'ownerInsertOrUpdateToken',
    [
      {
        token: pendleSystem.factory.address,
        decimals: await pendleSystem.factory.decimals(),
        oracleInfos: [
          {
            oracle: pendleSystem.oracle.address,
            tokenPair: token.address,
            weight: 100,
          },
        ],
      },
    ],
  );
}

export async function encodeInsertRedstoneOracleV3<T extends NetworkType>(
  core: CoreProtocolWithRedstone<T>,
  token: IERC20,
  invertPrice: boolean = REDSTONE_PRICE_AGGREGATORS_MAP[core.config.network][token.address]!.invert ?? false,
  tokenPairAddress: string | undefined = REDSTONE_PRICE_AGGREGATORS_MAP[core.config.network][token.address]!
    .tokenPairAddress,
  aggregatorAddress: string = REDSTONE_PRICE_AGGREGATORS_MAP[core.config.network][token.address]!.aggregatorAddress,
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  console.log(`\tRedstone price for ${symbol}:`, (await aggregator.latestRoundData()).answer.toString());

  setMostRecentTokenDecimals(tokenDecimals);
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { redstonePriceOracle: core.redstonePriceOracleV3 },
      'redstonePriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.redstonePriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}
