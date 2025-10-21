import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

/**
 * This script encodes the following transactions:
 * - Updates berachain rewards registry
 * - Sets wiBgt
 * - Updates infrared meta vault
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const registryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementationV4',
  );
  const metaVaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTMetaVaultWithOwnerStake',
    [core.dolomiteMargin.address],
    'InfraredBGTMetaVaultWithOwnerStakeImplementationV2',
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
      'ownerSetWiBgt',
      [core.tokens.wiBgt.address],
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
      assertHardhatInvariant(
        await core.berachainRewardsEcosystem.live.registryProxy.implementation() === registryImplementationAddress,
        'Invalid registry implementation'
      );
      assertHardhatInvariant(
        await core.berachainRewardsEcosystem.live.registry.wiBgt() === core.tokens.wiBgt.address,
        'Invalid wiBgt'
      );
      assertHardhatInvariant(
        await core.berachainRewardsEcosystem.live.registry.metaVaultImplementation() === metaVaultImplementationAddress,
        'Invalid meta vault implementation',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
