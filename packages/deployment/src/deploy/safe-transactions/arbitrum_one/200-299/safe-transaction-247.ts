import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Executes #224
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const startId = 652;
  const count = 39; // 690 final ID
  const transactionIds = [
    ...Array(count).fill(0).map((_, i) => startId + i),
  ];
  for (let i = 0; i < transactionIds.length; i++) {
    const transactionId = transactionIds[i];
    const transaction = await core.delayedMultiSig.transactions(transactionId);
    const isConfirmed = await core.delayedMultiSig.isConfirmed(transactionId);
    if (transaction[3]) {
      return Promise.reject(new Error(`Transaction already executed: ${transactionId}`));
    }
    if (!isConfirmed) {
      return Promise.reject(new Error(`Transaction not confirmed: ${transactionId}`));
    }
  }

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'delayedMultiSig',
      'executeMultipleTransactions',
      [transactionIds],
    ),
  ];

  return {
    core,
    upload: {
      transactions,
      chainId: network,
    },
    scriptName: getScriptName(__filename),
  };
}

doDryRunAndCheckDeployment(main);
