import { getTWAPPriceOracleConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys 3 new Wrapper contracts for PT-wstETH (2024 + 2025) and PT-rETH (2025)
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const sizeTwapOracleAddress = await deployContractAndSave(
    Number(network),
    'TWAPPriceOracle',
    getTWAPPriceOracleConstructorParams(core, core.tokens.size!, [core.camelotEcosystem!.sizeWethV3Pool]),
    'SizeTWAPPriceOracleV1',
  );
  const transactions: EncodedTransaction[] = [];

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
