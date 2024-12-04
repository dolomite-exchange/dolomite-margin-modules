import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IERC20__factory } from 'packages/base/src/types';
import { CHAOS_LABS_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import {
  getGlvIsolationModeTokenVaultConstructorParams,
  getGlvRegistryConstructorParams,
} from 'packages/glv/src/glv-constructors';
import { GlvRegistry__factory } from 'packages/glv/src/types';
import { GLV_CALLBACK_GAS_LIMIT } from 'packages/gmx-v2/src/gmx-v2-constructors';
import { getChaosLabsPriceOracleV3ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import {
  deployContractAndSave,
  deployGmxV2GlvTokenSystem,
  EncodedTransaction,
  GmxV2GlvTokenSystem,
  prettyPrintEncodeAddGlvMarket,
  prettyPrintEncodeInsertChaosLabsOracleV3,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Lists the two GLV vaults (BTC and ETH)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  await deployContractAndSave(
    'ChaosLabsPriceOracleV3',
    getChaosLabsPriceOracleV3ConstructorParams([], [], [], core.dolomiteRegistry, core.dolomiteMargin),
  );

  await deployContractAndSave('GlvLibrary', [], 'GlvLibraryV1');

  const registryImplementationAddress = await deployContractAndSave('GlvRegistry', [], 'GlvRegistryImplementationV1');
  const registryImplementation = GlvRegistry__factory.connect(registryImplementationAddress, core.hhUser1);
  await deployContractAndSave(
    'RegistryProxy',
    await getGlvRegistryConstructorParams(core, registryImplementation, GLV_CALLBACK_GAS_LIMIT),
    'GlvRegistryProxy',
  );

  await deployContractAndSave(
    'GlvIsolationModeTokenVaultV1',
    getGlvIsolationModeTokenVaultConstructorParams(core),
    'GlvIsolationModeTokenVaultImplementationV1',
    {
      ...core.glvEcosystem.live.glvLibraryMap,
      ...core.gmxV2Ecosystem.live.gmxV2LibraryMap,
      ...core.libraries.tokenVaultActionsImpl,
    },
  );
  await deployContractAndSave(
    'GlvIsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeUnwrapperTraderImplementationV2',
    {
      ...core.glvEcosystem.live.glvLibraryMap,
      ...core.gmxV2Ecosystem.live.gmxV2LibraryMap,
      ...core.libraries.unwrapperTraderImpl,
    },
  );
  await deployContractAndSave(
    'GlvIsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeWrapperTraderImplementationV2',
    {
      ...core.glvEcosystem.live.glvLibraryMap,
      ...core.gmxV2Ecosystem.live.gmxV2LibraryMap,
      ...core.libraries.wrapperTraderImpl,
    },
  );

  const glvTokens = [core.glvEcosystem.glvTokens.wbtcUsdc, core.glvEcosystem.glvTokens.wethUsdc];
  const underlyingGmTokens = [core.gmxV2Ecosystem.gmTokens.btcUsd, core.gmxV2Ecosystem.gmTokens.ethUsd];
  const supplyCaps = [parseEther(`${3_000_000}`), parseEther(`${12_000_000}`)];
  const glvNames = ['BTCV2', 'ETH'];
  const collateralizations = [TargetCollateralization._120, TargetCollateralization._120];
  const penalties = [TargetLiquidationPenalty.Base, TargetLiquidationPenalty.Base];

  const systems: GmxV2GlvTokenSystem[] = [];
  for (let i = 0; i < glvTokens.length; i += 1) {
    systems.push(await deployGmxV2GlvTokenSystem(core, glvTokens[i], glvNames[i]));
  }

  const marketId = await core.dolomiteMargin.getNumMarkets();
  const gmMarketIds: BigNumberish[] = [];
  for (let i = 0; i < glvTokens.length; i++) {
    gmMarketIds.push(marketId.add(i));
  }

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < systems.length; i++) {
    transactions.push(
      ...(await prettyPrintEncodeInsertChaosLabsOracleV3(
        core,
        IERC20__factory.connect(systems[i].factory.address, core.hhUser1),
        undefined,
        undefined,
        CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][glvTokens[i].glvToken.address]!.aggregatorAddress,
        { ignoreDescription: true },
      )),
      ...(await prettyPrintEncodeAddGlvMarket(
        core,
        systems[i].factory,
        underlyingGmTokens[i],
        systems[i].unwrapper,
        systems[i].wrapper,
        core.glvEcosystem.live.registry,
        gmMarketIds[i],
        collateralizations[i],
        penalties[i],
        supplyCaps[i],
      )),
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
      for (let i = 0; i < systems.length; i += 1) {
        assertHardhatInvariant(
          (await core.dolomiteMargin.getMarketTokenAddress(gmMarketIds[i])) === systems[i].factory.address,
          `Invalid factory at index ${i}`,
        );
        const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(gmMarketIds[i]);
        assertHardhatInvariant(
          liquidators[0] === core.liquidatorProxyV4.address && liquidators[1] === core.freezableLiquidatorProxy.address,
          'Invalid whitelisted liquidators',
        );
        assertHardhatInvariant(
          (await systems[i].factory.isTokenConverterTrusted(systems[i].unwrapper.address)) &&
            (await systems[i].factory.isTokenConverterTrusted(systems[i].wrapper.address)),
          'Invalid token converters',
        );

        const price = await core.dolomiteMargin.getMarketPrice(gmMarketIds[i]);
        console.log(`\tOracle price for ${glvNames[i]}: $${formatEther(price.value)}`);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
