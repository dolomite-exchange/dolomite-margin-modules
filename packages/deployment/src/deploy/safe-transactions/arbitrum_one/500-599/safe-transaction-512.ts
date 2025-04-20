import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeLibraryNames, IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';
import { deployContractAndSave } from '../../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Updates the GMX V2 and GLV isolation mode vaults
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const actionsImplAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV10'
  );
  const asyncActionsImplAddress = await deployContractAndSave(
    'AsyncIsolationModeTokenVaultV1ActionsImpl',
    [],
    'AsyncIsolationModeTokenVaultV1ActionsImplV1'
  );
  const libraries = {
    [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl]: actionsImplAddress,
    [IsolationModeLibraryNames.AsyncIsolationModeTokenVaultV1ActionsImpl]: asyncActionsImplAddress,
  };

  const transactions: EncodedTransaction[] = [];
  for (const deployedVault of core.deployedVaults) {
    if (
      deployedVault.vaultType === IsolationModeVaultType.GLV ||
      deployedVault.vaultType === IsolationModeVaultType.GmxV2
    ) {
      transactions.push(await deployedVault.deployNewVaultAndEncodeUpgradeTransaction(core, libraries));
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
    },
  };
}

doDryRunAndCheckDeployment(main);
