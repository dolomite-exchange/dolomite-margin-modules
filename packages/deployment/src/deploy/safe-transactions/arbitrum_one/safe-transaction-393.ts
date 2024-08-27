import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';
import {
  getGmxV2MarketTokenPriceOracleConstructorParams,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import {
  GmxV2IsolationModeVaultFactory,
  GmxV2MarketTokenPriceOracle,
  GmxV2MarketTokenPriceOracle__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import {
  CoreProtocolArbitrumOne,
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { IERC20, IsolationModeTraderProxy } from '@dolomite-exchange/modules-base/src/types';
import { formatUnits } from 'ethers/lib/utils';
import { LiveGmMarket } from '@dolomite-exchange/modules-base/test/utils/ecosystem-utils/gmx';

/**
 * This script encodes the following transactions:
 * - Sets each GM-Factory as the market token on the new GMX V2 Price oracle
 * - Sets the new GMX V2 price oracle on the oracle aggregator for each GM-Factory
 * - Sets the new user vault implementation for each GM-Factory
 * - Sets the new unwrapper trader implementation each GM-Factory unwrapper
 * - Sets the new wrapper trader implementation each GM-Factory wrapper
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2LibraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV7',
  );
  const userVaultImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    [core.tokens.weth.address, network],
    'GmxV2IsolationModeTokenVaultV14',
    { GmxV2Library: gmxV2LibraryAddress, ...core.libraries.tokenVaultActionsImpl },
  );
  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV10',
    { GmxV2Library: gmxV2LibraryAddress, ...core.libraries.unwrapperTraderImpl },
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV9',
    { GmxV2Library: gmxV2LibraryAddress, ...core.libraries.wrapperTraderImpl },
  );

  const gmxMarketPriceOracleAddress = await deployContractAndSave(
    'GmxV2MarketTokenPriceOracle',
    getGmxV2MarketTokenPriceOracleConstructorParams(core, core.gmxV2Ecosystem.live.registry),
    'GmxV2MarketTokenPriceOracleV3',
  );
  const gmxMarketTokenPriceOracle = GmxV2MarketTokenPriceOracle__factory.connect(
    gmxMarketPriceOracleAddress,
    core.hhUser1,
  );

  const liveMarkets: [LiveGmMarket, string][] = [
    [core.gmxV2Ecosystem.live.gmArbUsd, 'gmArbUsd'],
    [core.gmxV2Ecosystem.live.gmBtc, 'gmBtc'],
    [core.gmxV2Ecosystem.live.gmBtcUsd, 'gmBtcUsd'],
    [core.gmxV2Ecosystem.live.gmEth, 'gmEth'],
    [core.gmxV2Ecosystem.live.gmEthUsd, 'gmEthUsd'],
    [core.gmxV2Ecosystem.live.gmLinkUsd, 'gmLinkUsd'],
    [core.gmxV2Ecosystem.live.gmUniUsd, 'gmUniUsd'],
  ];

  const transactions: EncodedTransaction[] = [];
  for (const [liveMarket] of liveMarkets) {
    transactions.push(
      await encodeSetMarketToken(core, gmxMarketTokenPriceOracle, liveMarket.factory),
      await encodeSetOracleAggregator(core, gmxMarketTokenPriceOracle, liveMarket.factory),
      await encodeSetUserVaultImplementation(core, liveMarket.factory, userVaultImplementationAddress),
      await encodeSetUnwrapper(core, liveMarket.unwrapperProxy, unwrapperImplementationAddress),
      await encodeSetWrapper(core, liveMarket.wrapperProxy, wrapperImplementationAddress),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      for (const [liveMarket, label] of liveMarkets) {
        assertHardhatInvariant(
          await liveMarket.factory.userVaultImplementation() === userVaultImplementationAddress,
          `Invalid user vault implementation for ${label}`,
        );

        assertHardhatInvariant(
          await liveMarket.unwrapperProxy.implementation() === unwrapperImplementationAddress,
          `Invalid unwrapper implementation for ${label}`,
        );

        assertHardhatInvariant(
          await liveMarket.wrapperProxy.implementation() === wrapperImplementationAddress,
          `Invalid wrapper implementation for ${label}`,
        );

        await printPrice(core, liveMarket.factory, label);
      }
    },
  };
}

async function encodeSetMarketToken(
  core: CoreProtocolArbitrumOne,
  gmxMarketTokenPriceOracle: GmxV2MarketTokenPriceOracle,
  token: IERC20,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { gmxMarketTokenPriceOracle },
    'gmxMarketTokenPriceOracle',
    'ownerSetMarketToken',
    [token.address, true],
  );
}

async function encodeSetOracleAggregator(
  core: CoreProtocolArbitrumOne,
  gmxMarketTokenPriceOracle: GmxV2MarketTokenPriceOracle,
  token: IERC20,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { oracleAggregator: core.oracleAggregatorV2 },
    'oracleAggregator',
    'ownerInsertOrUpdateToken',
    [{
      oracleInfos: [{
        oracle: gmxMarketTokenPriceOracle.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100,
      }],
      decimals: 18,
      token: token.address,
    }],
  );
}

async function encodeSetUserVaultImplementation(
  core: CoreProtocolArbitrumOne,
  factory: GmxV2IsolationModeVaultFactory,
  userVaultAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { factory },
    'factory',
    'ownerSetUserVaultImplementation',
    [userVaultAddress],
  );
}

async function encodeSetUnwrapper(
  core: CoreProtocolArbitrumOne,
  unwrapper: IsolationModeTraderProxy,
  unwrapperAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { unwrapper },
    'unwrapper',
    'upgradeTo',
    [unwrapperAddress],
  );
}

async function encodeSetWrapper(
  core: CoreProtocolArbitrumOne,
  wrapper: IsolationModeTraderProxy,
  wrapperAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { wrapper },
    'wrapper',
    'upgradeTo',
    [wrapperAddress],
  );
}

async function printPrice(core: CoreProtocolArbitrumOne, token: IERC20, name: string) {
  const priceStruct = await core.dolomiteMargin.getMarketPrice(
    await core.dolomiteMargin.getMarketIdByTokenAddress(token.address),
  );
  console.log(`${name} price: ${formatUnits(priceStruct.value)}`);
}

doDryRunAndCheckDeployment(main);
