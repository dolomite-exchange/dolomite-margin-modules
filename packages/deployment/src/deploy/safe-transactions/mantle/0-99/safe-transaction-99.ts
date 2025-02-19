import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the new IsolationModeTokenVaultActionsImplementation
 * - Updates all isolation mode markets with new token vault
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const safeDelegateCallLibAddress = await deployContractAndSave('SafeDelegateCallLib', [], 'SafeDelegateCallLibV1');
  const actionsImplAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV9',
    { SafeDelegateCallLib: safeDelegateCallLibAddress },
  );

  const transactions: EncodedTransaction[] = [];
  for (const deployedVault of core.deployedVaults) {
    if (deployedVault.isUpgradeable) {
      transactions.push(
        await deployedVault.deployNewVaultAndEncodeUpgradeTransaction(
          core,
          { IsolationModeTokenVaultV1ActionsImpl: actionsImplAddress }
        ),
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
        assertHardhatInvariant(
          (await deployedVault.factory.userVaultImplementation()) === deployedVault.implementationAddress,
          `Invalid user vault implementation for ${deployedVault.contractName}`,
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
