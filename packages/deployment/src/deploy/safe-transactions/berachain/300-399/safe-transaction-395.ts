import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkAccountRiskOverrideIsBorrowOnly, checkSupplyCap } from '../../../../utils/invariant-utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Create the BerachainRewardsReader
 * - Update the Infrared meta vault + registry to expose new functions
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  await deployContractAndSave(
    'BerachainRewardsReader',
    [core.berachainRewardsEcosystem.live.registry.address],
    'BerachainRewardsReaderV2',
  );
  const metaVaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTMetaVault',
    [],
    'InfraredBGTMetaVaultImplementationV2',
  );
  const registryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementationV2',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registryProxy',
      'upgradeTo',
      [registryImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.berachainRewardsEcosystem.live,
      'registry',
      'ownerSetMetaVaultImplementation',
      [metaVaultImplementationAddress],
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
      await checkSupplyCap(core, core.marketIds.pumpBtc, ONE_BI);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.pumpBtc);
    },
  };
}

doDryRunAndCheckDeployment(main);
