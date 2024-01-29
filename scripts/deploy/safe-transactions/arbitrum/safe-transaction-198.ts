import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys a new jUSDC Token Vault to handle auto staking if jUSDC deposit incentives are disabled
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const vaultV7 = await deployContractAndSave(
    core.config.networkNumber,
    'JonesUSDCIsolationModeTokenVaultV2',
    [],
    'JonesUSDCIsolationModeTokenVaultV8',
    core.tokenVaultActionsLibraries,
  );

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCIsolationModeFactory',
      'ownerSetUserVaultImplementation',
      [vaultV7],
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
