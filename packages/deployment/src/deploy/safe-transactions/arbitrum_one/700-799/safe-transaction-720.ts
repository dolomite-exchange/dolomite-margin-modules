import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ModuleDeployments } from '../../../../utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';

/**
 * This script encodes the following transactions:
 * - Upgrades GMX V2 vaults with new library
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const gmxV2VaultLibraryMap = { GmxV2VaultLibrary: ModuleDeployments.GmxV2VaultLibraryV1[network].address };

  const transactions: EncodedTransaction[] = [];
  for (const deployedVault of core.deployedVaults) {
    if (deployedVault.vaultType === IsolationModeVaultType.GmxV2) {
      transactions.push(
        await deployedVault.deployNewVaultAndEncodeUpgradeTransaction(core, { ...gmxV2VaultLibraryMap }),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
