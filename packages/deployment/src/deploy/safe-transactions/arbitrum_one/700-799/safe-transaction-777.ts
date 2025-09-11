import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

/**
 * This script encodes the following transactions:
 * - Reverts to old GMX V2 vault
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  for (const deployedVault of core.deployedVaults) {
    if (deployedVault.vaultType === IsolationModeVaultType.GmxV2) {
      transactions.push(
        // await deployedVault.encodeSetUserVaultImplementationWithAddress(core, '0x5A9281d46074Cc4010F17AF5cF35C8302377e817'), // this one has the extra handler functions
        await deployedVault.encodeSetUserVaultImplementationWithAddress(core, '0x992216D420023c9838F41817cA088486076D1F59'), // this one does not
      );
    }
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
      for (const deployedVault of core.deployedVaults) {
        if (deployedVault.vaultType === IsolationModeVaultType.GmxV2) {
          assertHardhatInvariant(
            (await deployedVault.factory.userVaultImplementation()) === '0x5A9281d46074Cc4010F17AF5cF35C8302377e817',
            'Invalid user vault implementation for GMX V2 vault',
          );
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
