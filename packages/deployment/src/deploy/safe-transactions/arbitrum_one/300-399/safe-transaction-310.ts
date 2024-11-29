import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  GMX_V2_EXECUTION_FEE,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import {
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeVaultFactory__factory,
  IGmxV2IsolationModeUnwrapperTraderV2,
  IGmxV2IsolationModeUnwrapperTraderV2__factory,
  IGmxV2IsolationModeWrapperTraderV2,
  IGmxV2IsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodeAddAsyncIsolationModeMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys new gmUNI vault
 * - Increases the PT-ezETH supply cap to 3,000
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(
    ModuleDeployments.GmxV2IsolationModeTokenVaultImplementationV14[network].address,
    core.hhUser1,
  );

  const gmTokens = [core.gmxV2Ecosystem.gmTokens.uniUsd];
  const supplyCaps = [parseEther(`${600_000}`)];
  const gmNames = ['UNI'];

  const unwrapperImplementation = core.gmxV2Ecosystem.live.unwrapperImplementation;
  const wrapperImplementation = core.gmxV2Ecosystem.live.wrapperImplementation;
  const gmxV2PriceOracle = core.gmxV2Ecosystem.live.priceOracle;

  const factories: GmxV2IsolationModeVaultFactory[] = [];
  const unwrappers: IGmxV2IsolationModeUnwrapperTraderV2[] = [];
  const wrappers: IGmxV2IsolationModeWrapperTraderV2[] = [];
  const stablecoins = core.marketIds.stablecoins;
  const usdcIndex = stablecoins.findIndex((m) => BigNumber.from(m).eq(core.marketIds.nativeUsdc));
  const firstValue = stablecoins[0];
  stablecoins[0] = stablecoins[usdcIndex];
  stablecoins[usdcIndex] = firstValue;

  for (let i = 0; i < gmTokens.length; i += 1) {
    const factoryAddress = await deployContractAndSave(
      'GmxV2IsolationModeVaultFactory',
      getGmxV2IsolationModeVaultFactoryConstructorParams(
        core,
        core.gmxV2Ecosystem.live.registry,
        [gmTokens[i].longMarketId, ...core.marketIds.stablecoins],
        [gmTokens[i].longMarketId, ...core.marketIds.stablecoins],
        gmTokens[i],
        gmxV2TokenVault,
        GMX_V2_EXECUTION_FEE,
        false,
      ),
      `GmxV2${gmNames[i]}IsolationModeVaultFactory`,
      core.gmxV2Ecosystem.live.gmxV2LibraryMap,
    );
    const factory = GmxV2IsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

    const unwrapperProxyAddress = await deployContractAndSave(
      'IsolationModeTraderProxy',
      await getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
        core,
        unwrapperImplementation,
        factory,
        core.gmxV2Ecosystem.live.registry,
        false,
      ),
      `GmxV2${gmNames[i]}AsyncIsolationModeUnwrapperTraderProxyV2`,
    );

    const wrapperProxyAddress = await deployContractAndSave(
      'IsolationModeTraderProxy',
      await getGmxV2IsolationModeWrapperTraderV2ConstructorParams(
        core,
        wrapperImplementation,
        factory,
        core.gmxV2Ecosystem.live.registry,
        false,
      ),
      `GmxV2${gmNames[i]}AsyncIsolationModeWrapperTraderProxyV2`,
    );

    factories.push(factory);
    unwrappers.push(IGmxV2IsolationModeUnwrapperTraderV2__factory.connect(unwrapperProxyAddress, core.hhUser1));
    wrappers.push(IGmxV2IsolationModeWrapperTraderV2__factory.connect(wrapperProxyAddress, core.hhUser1));
  }

  const marketId = await core.dolomiteMargin.getNumMarkets();
  const gmMarketIds: BigNumberish[] = [];
  for (let i = 0; i < gmTokens.length; i++) {
    gmMarketIds.push(marketId.add(i));
  }

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < factories.length; i++) {
    const factory = factories[i];
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core.gmxV2Ecosystem.live,
        'registry',
        'ownerSetGmxMarketToIndexToken',
        [gmTokens[i].marketToken.address, gmTokens[i].indexToken.address],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core.gmxV2Ecosystem.live,
        'registry',
        'ownerSetGmxMarketToIndexToken',
        [gmTokens[i].marketToken.address, gmTokens[i].indexToken.address],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { gmxV2PriceOracle },
        'gmxV2PriceOracle',
        'ownerSetMarketToken',
        [factory.address, true],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { oracleAggregatorV2: core.oracleAggregatorV2 },
        'oracleAggregatorV2',
        'ownerInsertOrUpdateToken',
        [
          {
            decimals: await factory.decimals(),
            token: factory.address,
            oracleInfos: [
              {
                oracle: gmxV2PriceOracle.address,
                weight: 100,
                tokenPair: ADDRESS_ZERO,
              },
            ],
          },
        ],
      ),
      ...(await prettyPrintEncodeAddAsyncIsolationModeMarket(
        core,
        factory,
        core.oracleAggregatorV2,
        unwrappers[i],
        wrappers[i],
        core.gmxV2Ecosystem.live.registry,
        gmMarketIds[i],
        TargetCollateralization._125,
        TargetLiquidationPenalty.Base,
        supplyCaps[i],
      )),
    );
  }

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dPtEzEthJun2024, parseEther(`${3_000}`)],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(factories.length === 1, 'Invalid # of factories');
      for (let i = 0; i < factories.length; i += 1) {
        assertHardhatInvariant(
          (await core.dolomiteMargin.getMarketTokenAddress(gmMarketIds[i])) === factories[i].address,
          `Invalid factory at index ${i}`,
        );
        const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(gmMarketIds[i]);
        assertHardhatInvariant(
          liquidators[0] === core.liquidatorProxyV4.address && liquidators[1] === core.freezableLiquidatorProxy.address,
          'Invalid whitelisted liquidators',
        );
        assertHardhatInvariant(
          (await factories[i].isTokenConverterTrusted(unwrappers[i].address)) &&
            (await factories[i].isTokenConverterTrusted(wrappers[i].address)),
          'Invalid token converters',
        );

        const price = await core.dolomiteMargin.getMarketPrice(gmMarketIds[i]);
        console.log(`\tOracle price for ${gmNames[i]}: `, price.value.toString());
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
