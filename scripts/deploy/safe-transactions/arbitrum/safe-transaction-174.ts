import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Executes #167 and #168
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const startId = 290;
  const count = 86; // 375 final ID
  const transactionIds = [
    ...Array(count).fill(0).map((_, i) => startId + i),
  ];
  for (let i = 0; i < transactionIds.length; i++) {
    const transactionId = transactionIds[i];
    if (transactionId === 302) {
      transactionIds[i] = 377;
    } else {
      const transaction = await core.delayedMultiSig.transactions(transactionId);
      const isConfirmed = await core.delayedMultiSig.isConfirmed(transactionId);
      if (transaction[3]) {
        return Promise.reject(new Error(`Transaction already executed: ${transactionId}`));
      } else if (!isConfirmed) {
        return Promise.reject(new Error(`Transaction not confirmed: ${transactionId}`));
      }
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
    transactions,
    chainId: network,
  };
}

main()
  .then(jsonUpload => {
    if (typeof jsonUpload === 'undefined') {
      return;
    }

    const path = require('path');
    const scriptName = path.basename(__filename).slice(0, -3);
    const dir = `${__dirname}/output`;
    createFolder(dir);
    writeFile(`${dir}/${scriptName}.json`, JSON.stringify(jsonUpload, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
