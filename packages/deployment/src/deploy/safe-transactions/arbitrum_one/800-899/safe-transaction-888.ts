import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Upgrades the GMX V2 registry
 * - Upgrades the GLV registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const gmxRegistryImplAddress = await deployContractAndSave(
    'GmxV2Registry',
    [],
    'GmxV2RegistryImplementationV5',
  );
  const glvRegistryImplAddress = await deployContractAndSave(
    'GlvRegistry',
    [],
    'GlvRegistryImplementationV5',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live,
      'registryProxy',
      'upgradeTo',
      [gmxRegistryImplAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registryProxy',
      'upgradeTo',
      [glvRegistryImplAddress],
    ),
  ];

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
        await core.gmxV2Ecosystem.live.registry.isHandler(core.gmxV2Ecosystem.gmxDepositHandlerV2.address),
        'Invalid GMX deposit handler',
      );
      assertHardhatInvariant(
        await core.gmxV2Ecosystem.live.registry.isHandler(core.gmxV2Ecosystem.gmxWithdrawalHandlerV2.address),
        'Invalid GMX withdrawal handler',
      );
      assertHardhatInvariant(
        await core.glvEcosystem.live.registry.isHandler(core.glvEcosystem.glvDepositHandler.address),
        'Invalid GLV deposit handler',
      );
      assertHardhatInvariant(
        await core.glvEcosystem.live.registry.isHandler(core.glvEcosystem.glvWithdrawalHandler.address),
        'Invalid GLV withdrawal handler',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
