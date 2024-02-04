import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys and sets the new GMX isolation mode vault (for auto staking GMX rewards)
 * - Updates the GMX rewards router to the new address
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const vaultV5 = await deployContractAndSave(
    core.config.networkNumber,
    'GMXIsolationModeTokenVaultV1',
    [],
    'GMXIsolationModeTokenVaultV6',
    core.tokenVaultActionsLibraries,
  );

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGmx',
      'ownerSetUserVaultImplementation',
      [vaultV5],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'gmxRegistry',
      'ownerSetGmxRewardsRouter',
      [core.gmxEcosystem!.gmxRewardsRouterV3.address],
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
