import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import { createFolder, DenJsonUpload, prettyPrintEncodedDataWithTypeSafety, writeFile } from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Executes safe tx #159
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const startId = 252;
  const count = 11;
  const transactionIds = Array(count).fill(0).map((_, i) => startId + i);
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
