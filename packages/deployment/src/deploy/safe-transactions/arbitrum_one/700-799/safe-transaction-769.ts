import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeLibraryNames, IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';

/**
 * This script encodes the following transactions:
 * - Deploy the new IsolationModeTokenVaultV1ActionsImpl for the Routers
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const actionsAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV12',
  );
  const glpActionsLibAddress = await deployContractAndSave(
    'GLPActionsLib',
    [],
    'GLPActionsLibV2',
  );
  const newLibraries = { [IsolationModeLibraryNames.IsolationModeTokenVaultV1ActionsImpl]: actionsAddress };

  const transactions: EncodedTransaction[] = [];
  for (const vault of core.deployedVaults) {
    if (vault.isUpgradeable) {
      if (vault.vaultType === IsolationModeVaultType.GLP) {
        transactions.push(await vault.deployNewVaultAndEncodeUpgradeTransaction(core, {
          ...newLibraries,
          [IsolationModeLibraryNames.GlpActionsLibrary]: glpActionsLibAddress,
        }));
      } else {
        transactions.push(await vault.deployNewVaultAndEncodeUpgradeTransaction(core, newLibraries));
      }
    }
  }

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
    },
  };
}

doDryRunAndCheckDeployment(main);
