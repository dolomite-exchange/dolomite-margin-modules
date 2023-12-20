import { parseEther } from 'ethers/lib/utils';
import {
  ARBIsolationModeTokenVaultV1__factory,
  ARBIsolationModeVaultFactory__factory,
  ARBRegistry__factory,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory__factory,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2__factory,
} from '../../../../src/types';
import {
  getARBIsolationModeVaultFactoryConstructorParams,
  getARBRegistryConstructorParams,
  getARBUnwrapperTraderV2ConstructorParams,
  getARBWrapperTraderV2ConstructorParams,
} from '../../../../src/utils/constructors/arb';
import { TargetCollateralization, TargetLiquidationPenalty } from '../../../../src/utils/constructors/dolomite';
import {
  getGMXIsolationModeVaultFactoryConstructorParams,
  getGMXUnwrapperTraderV2ConstructorParams,
  getGMXWrapperTraderV2ConstructorParams,
} from '../../../../src/utils/constructors/gmx';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  getTokenVaultLibrary,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeAddMarket, prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChainlinkOracle,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys 3 new Wrapper contracts for PT-wstETH (2024 + 2025) and PT-rETH (2025)
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const glpVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeTokenVaultV2',
    [],
    undefined,
    getTokenVaultLibrary(core),
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'glpIsolationModeFactory',
      'setUserVaultImplementation',
      [glpVaultImplementationAddress],
    )
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
