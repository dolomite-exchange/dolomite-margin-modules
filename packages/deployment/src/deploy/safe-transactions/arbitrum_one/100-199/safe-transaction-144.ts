import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  createFolder,
  writeFile,
} from '../../../../utils/deploy-utils';
import { DenJsonUpload } from '../../../../utils/dry-run-utils';
import { encodeInsertChainlinkOracle } from '../../../../utils/encoding/oracle-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Updates the wstETH oracle from Chainlink to use the proper exchange rate one
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const transactions = [];
  transactions.push(
    await encodeInsertChainlinkOracle(
      core,
      core.tokens.wstEth!,
      core.tokens.stEth!.address,
    ),
  );
  transactions.push(
    await encodeInsertChainlinkOracle(
      core,
      core.tokens.stEth!,
      core.tokens.weth.address,
    ),
  );

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
