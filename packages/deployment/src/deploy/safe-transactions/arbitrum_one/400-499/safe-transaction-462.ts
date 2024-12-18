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
 * - Deploys the new GLP token vault
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const glpTokenVaultAddress = await deployContractAndSave(
    'GLPIsolationModeTokenVaultV2',
    [],
    'GLPIsolationModeTokenVaultV7',
    { ...core.libraries.tokenVaultActionsImpl },
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem.live,
      'dGlp',
      'setUserVaultImplementation',
      [glpTokenVaultAddress],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.gmxEcosystem.live.dGlp.userVaultImplementation()) === glpTokenVaultAddress,
        'GLV-BTC deposit GM token is incorrect',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
