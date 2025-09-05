import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';
import { deployContractAndSave, getMaxDeploymentVersionNumberByDeploymentKey } from 'packages/deployment/src/utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Upgrades GMX V2 vaults with new library
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2VaultLibraryAddress = await deployContractAndSave(
    'GmxV2VaultLibrary',
    [],
    'GmxV2VaultLibraryV1'
  );
  const gmxV2VaultLibraryMap = { GmxV2VaultLibrary: gmxV2VaultLibraryAddress };
  const transactions: EncodedTransaction[] = [];
  for (const deployedVault of core.deployedVaults) {
    if (deployedVault.vaultType === IsolationModeVaultType.GmxV2) {
      transactions.push(
        await deployedVault.deployNewVaultAndEncodeUpgradeTransaction(core, { ...gmxV2VaultLibraryMap })
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
