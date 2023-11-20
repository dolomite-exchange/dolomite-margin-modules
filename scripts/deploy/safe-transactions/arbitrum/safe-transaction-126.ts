import { BigNumber } from 'ethers/lib/ethers';
import { parseEther } from 'ethers/lib/utils';
import { LinearStepFunctionInterestSetter__factory, TWAPPriceOracle__factory } from '../../../../src/types';
import { getOwnerAddMarketParameters } from '../../../../src/utils/constructors/dolomite';
import { getTWAPPriceOracleConstructorParams } from '../../../../src/utils/constructors/oracles';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  deployContractAndSave,
  deployLinearInterestSetterAndSave,
  InterestSetterType,
  prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChainlinkOracle,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Creates the rETH June 2025 PT contracts
 * - Creates the wstETH June 2024 PT contracts
 * - Creates the wstETH June 2025 PT contracts
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  
}

main()
  .then(jsonUpload => {
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
