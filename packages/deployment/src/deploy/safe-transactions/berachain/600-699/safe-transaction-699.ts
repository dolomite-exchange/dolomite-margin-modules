import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

/**
 * This script encodes the following transactions:
 * - Updates the infrared meta vault implementation
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  // @follow-up Corey, we had a MetaVaultWithOwnerStake. I don't see it currently active, but please check which one it should be
  const metaVaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTMetaVault',
    [core.tokens.ir.address, core.berachainRewardsEcosystem.infraredMerkleDistributor.address],
    'InfraredBGTMetaVaultImplementationV3',
  );
  const transactions: EncodedTransaction[] = [
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
        await core.berachainRewardsEcosystem.live.registry.metaVaultImplementation() === metaVaultImplementationAddress,
        'Invalid meta vault implementation address',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
