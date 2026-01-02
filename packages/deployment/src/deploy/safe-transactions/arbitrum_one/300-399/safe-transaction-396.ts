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
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddGmxV2Market } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Lists new GM assets (AAVE, DOGE, GMX, SOL, and wstETH)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(
    ModuleDeployments.GmxV2IsolationModeTokenVaultImplementationV14[network].address,
    core.hhUser1,
  );

  const gmTokens = [
    core.gmxV2Ecosystem.gmTokens.aaveUsd,
    core.gmxV2Ecosystem.gmTokens.dogeUsd,
    core.gmxV2Ecosystem.gmTokens.gmxUsd,
    core.gmxV2Ecosystem.gmTokens.solUsd,
    core.gmxV2Ecosystem.gmTokens.wstEthUsd,
  ];
  const supplyCaps = [
    parseEther(`${1_000_000}`),
    parseEther(`${1_750_000}`),
    parseEther(`${1_750_000}`),
    parseEther(`${3_000_000}`),
    parseEther(`${1_000_000}`),
  ];
  const gmNames = [
    'AAVE',
    'DOGE',
    'GMX',
    'SOL',
    'WstETH',
  ];
  const collateralizations = [
    TargetCollateralization._125,
    TargetCollateralization._125,
    TargetCollateralization._125,
    TargetCollateralization._125,
    TargetCollateralization._120,
  ];
  const penalties = [
    TargetLiquidationPenalty.Base,
    TargetLiquidationPenalty.Base,
    TargetLiquidationPenalty.Base,
    TargetLiquidationPenalty.Base,
    TargetLiquidationPenalty.Base,
  ];

  const unwrapperImplementation = core.gmxV2Ecosystem.live.unwrapperImplementation;
  const wrapperImplementation = core.gmxV2Ecosystem.live.wrapperImplementation;

  const factories: GmxV2IsolationModeVaultFactory[] = [];
  const unwrappers: IGmxV2IsolationModeUnwrapperTraderV2[] = [];
  const wrappers: IGmxV2IsolationModeWrapperTraderV2[] = [];

  for (let i = 0; i < gmTokens.length; i += 1) {
    const stablecoins = core.marketIds.stablecoins;
    const shortIndex = stablecoins.findIndex((m) => BigNumber.from(m).eq(gmTokens[i].shortMarketId));
    const firstValue = stablecoins[0];
    stablecoins[0] = stablecoins[shortIndex];
    stablecoins[shortIndex] = firstValue;

    const longMarketId = gmTokens[i].longMarketId;
    const debtMarketIds = [...stablecoins];
    const collateralMarketIds = [...stablecoins];
    if (longMarketId !== -1) {
      debtMarketIds.unshift(longMarketId);
      collateralMarketIds.unshift(longMarketId);
    }

    const factoryAddress = await deployContractAndSave(
      'GmxV2IsolationModeVaultFactory',
      getGmxV2IsolationModeVaultFactoryConstructorParams(
        core,
        core.gmxV2Ecosystem.live.registry,
        debtMarketIds,
        collateralMarketIds,
        gmTokens[i],
        gmxV2TokenVault,
        GMX_V2_EXECUTION_FEE,
        longMarketId === -1,
      ),
      `GmxV2${gmNames[i]}IsolationModeVaultFactory`,
      core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap,
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

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertChainlinkOracleV3(
      core,
      core.gmxV2Ecosystem.gmTokens.aaveUsd.longToken,
    ),
    ...await encodeInsertChainlinkOracleV3(
      core,
      core.gmxV2Ecosystem.gmTokens.dogeUsd.indexToken,
    ),
    ...await encodeInsertChainlinkOracleV3(
      core,
      core.gmxV2Ecosystem.gmTokens.solUsd.longToken,
    ),
  ];

  for (let i = 0; i < factories.length; i++) {
    const factory = factories[i];
    transactions.push(
      ...await encodeAddGmxV2Market(
        core,
        factory,
        unwrappers[i],
        wrappers[i],
        core.gmxV2Ecosystem.live.registry,
        gmMarketIds[i],
        collateralizations[i],
        penalties[i],
        supplyCaps[i],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
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
