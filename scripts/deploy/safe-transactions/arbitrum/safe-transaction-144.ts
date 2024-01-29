import {
  STETH_ETH_CHAINLINK_FEED_MAP,
  WSTETH_STETH_CHAINLINK_FEED_MAP,
} from '../../../../packages/base/src/utils/constants';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import { createFolder, DenJsonUpload, prettyPrintEncodeInsertChainlinkOracle, writeFile } from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Updates the wstETH oracle from Chainlink to use the proper exchange rate one
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const transactions = [];
  transactions.push(
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      core.tokens.wstEth!,
      WSTETH_STETH_CHAINLINK_FEED_MAP[network]!,
      core.tokens.stEth!.address,
    ),
  );
  transactions.push(
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      core.tokens.stEth!,
      STETH_ETH_CHAINLINK_FEED_MAP[network]!,
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
