import { sleep } from '@openzeppelin/upgrades';
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
 * - Revokes confirmations on old transactions that will not be executed any more.
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const startId = 252;
  const count = 35; // 286 final ID
  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < count; i++) {
    const id = startId + i;

    const transaction = await core.delayedMultiSig.transactions(id);
    if (transaction.executed) {
      return Promise.reject(new Error(`Transaction was executed: ${id}`));
    }

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core,
        'delayedMultiSig',
        'revokeConfirmation',
        [id],
      ),
    );
    await sleep(100);
  }

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
