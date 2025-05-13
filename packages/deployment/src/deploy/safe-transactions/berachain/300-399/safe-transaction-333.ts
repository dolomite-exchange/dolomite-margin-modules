import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { getBerachainRewardsRegistryConstructorParams } from 'packages/berachain/src/berachain-constructors';
import {
  BerachainRewardsRegistry__factory,
  InfraredBGTMetaVault__factory,
  POLIsolationModeUnwrapperTraderV2__factory,
  POLIsolationModeWrapperTraderV2__factory,
  POLLiquidatorProxyV1__factory
} from 'packages/berachain/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

/**
 * This script encodes the following transactions:
 * - Sets up POL ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  const infraredMetavaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTMetaVault',
    [],
    'InfraredBGTMetaVaultImplementationV1',
  );
  const infraredMetavaultImplementation = InfraredBGTMetaVault__factory.connect(
    infraredMetavaultImplementationAddress,
    core.governance,
  );

  // Deploy POL liquidator proxy
  const polLiquidatorImplementationAddress = await deployContractAndSave(
    'POLLiquidatorProxyV1',
    [core.liquidatorProxyV5.address, core.dolomiteMargin.address],
    'POLLiquidatorProxyImplementationV1',
  );
  const polLiquidatorImplementation = POLLiquidatorProxyV1__factory.connect(polLiquidatorImplementationAddress, core.governance);

  const data = await polLiquidatorImplementation.populateTransaction.initialize();
  const polLiquidatorProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    [polLiquidatorImplementationAddress, core.dolomiteMargin.address, data.data!],
    'POLLiquidatorProxy',
  );
  const polLiquidatorProxy = POLLiquidatorProxyV1__factory.connect(polLiquidatorProxyAddress, core.governance);

  // Deploy BerachainRewardsRegistry
  const registryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementationV1',
  );
  const registryImplementation = BerachainRewardsRegistry__factory.connect(registryImplementationAddress, core.governance);

  const registryAddress = await deployContractAndSave(
    'RegistryProxy',
    await getBerachainRewardsRegistryConstructorParams(registryImplementation, infraredMetavaultImplementation, polLiquidatorProxy, core),
    'BerachainRewardsRegistryProxy',
  );
  const registry = BerachainRewardsRegistry__factory.connect(registryAddress, core.governance);

  // Deploy POL isolation mode token vault, wrapper and unwrapper
  await deployContractAndSave(
    'POLIsolationModeTokenVaultV1',
    [],
    'POLIsolationModeTokenVaultImplementationV1',
    core.libraries.tokenVaultActionsImpl,
  );

  const unwrapperImplementationAddress = await deployContractAndSave(
    'POLIsolationModeUnwrapperTraderV2',
    [registry.address, core.dolomiteMargin.address],
    'POLIsolationModeUnwrapperTraderImplementationV2',
  );
  const unwrapperImplementation = POLIsolationModeUnwrapperTraderV2__factory.connect(
    unwrapperImplementationAddress,
    core.governance,
  );

  const wrapperImplementationAddress = await deployContractAndSave(
    'POLIsolationModeWrapperTraderV2',
    [registry.address, core.dolomiteMargin.address],
    'POLIsolationModeWrapperTraderImplementationV2',
  );
  const wrapperImplementation = POLIsolationModeWrapperTraderV2__factory.connect(
    wrapperImplementationAddress,
    core.governance,
  );

  // set pol wrapper/unwrapper
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry: registry },
      'berachainRewardsRegistry',
      'ownerSetPolWrapperTrader',
      [wrapperImplementation.address],
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry: registry },
      'berachainRewardsRegistry',
      'ownerSetPolUnwrapperTrader',
      [unwrapperImplementation.address],
    )
  );

  // set pol fee agent and fee percentage
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry: registry },
      'berachainRewardsRegistry',
      'ownerSetPolFeeAgent',
      [core.gnosisSafe.address], // @follow-up adjust
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry: registry },
      'berachainRewardsRegistry',
      'ownerSetPolFeePercentage',
      [parseEther('0.03')], // @follow-up adjust
    )
  );

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant(
        (await registry.metaVaultImplementation()) === infraredMetavaultImplementationAddress,
        'Invalid meta vault implementation address',
      );
      assertHardhatInvariant(
        (await registry.polLiquidator()) === polLiquidatorProxyAddress,
        'Invalid POL liquidator proxy address',
      );
      assertHardhatInvariant(
        (await registry.polWrapperTrader()) === wrapperImplementationAddress,
        'Invalid POL wrapper trader address',
      );
      assertHardhatInvariant(
        (await registry.polUnwrapperTrader()) === unwrapperImplementationAddress,
        'Invalid POL unwrapper trader address',
      );
      assertHardhatInvariant(
        (await registry.polFeeAgent()) === core.gnosisSafe.address,
        'Invalid POL fee agent address',
      );
      assertHardhatInvariant(
        (await registry.polFeePercentage(0)).eq(parseEther('0.03')),
        'Invalid POL fee percentage',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
