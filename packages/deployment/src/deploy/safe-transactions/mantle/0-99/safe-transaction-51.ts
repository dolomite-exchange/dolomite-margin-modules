import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the cmETH token vault
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const tokenVaultAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtcmETHFeb2025IsolationModeTokenVaultV2',
    core.libraries.tokenVaultActionsImpl,
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.pendleEcosystem.cmEthFeb2025.factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [tokenVaultAddress],
    ),
  );
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
        await core.pendleEcosystem.cmEthFeb2025.factory.userVaultImplementation() === tokenVaultAddress,
        'Invalid token vault',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
