import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the security council
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const glpActionsLib = await deployContractAndSave('GLPActionsLib', []);

  const vaultAddress = await deployContractAndSave(
    'GLPIsolationModeTokenVaultV3Paused',
    [],
    'GLPIsolationModeTokenVaultV11Paused',
    { ...core.libraries.tokenVaultActionsImpl, GLPActionsLib: glpActionsLib },
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.gmxEcosystem.live, 'dGlp', 'setUserVaultImplementation', [
      vaultAddress,
    ]),
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
