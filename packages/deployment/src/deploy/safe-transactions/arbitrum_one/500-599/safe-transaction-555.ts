import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the new IsolationModeTokenVaultV1ActionsImpl
 * - Deploys the new AsyncIsolationModeTokenVaultV1ActionsImpl
 * - Updates all isolation mode markets with new token vault
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const actionsImplAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV10',
    core.libraries.safeDelegateCallImpl,
  );
  const asyncActionsImplAddress = await deployContractAndSave(
    'AsyncIsolationModeTokenVaultV1ActionsImpl',
    [],
    'AsyncIsolationModeTokenVaultV1ActionsImplV1',
    { IsolationModeTokenVaultV1ActionsImpl: actionsImplAddress }
  );
  const asyncActionsImplMap = { AsyncIsolationModeTokenVaultV1ActionsImpl: asyncActionsImplAddress };

  const transactions: EncodedTransaction[] = [];
  for (const deployedVault of core.deployedVaults) {
    if (deployedVault.isUpgradeable) {
      let libraries: any = { IsolationModeTokenVaultV1ActionsImpl: actionsImplAddress };

      if (deployedVault.vaultType === IsolationModeVaultType.GLV) {
        libraries = {
          ...libraries,
          ...asyncActionsImplMap,
        };
      } else if (deployedVault.vaultType === IsolationModeVaultType.GmxV2) {
        libraries = {
          ...libraries,
          ...asyncActionsImplMap,
        };
      }

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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
