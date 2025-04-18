import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  createFolder,
  deployContractAndSave,
  writeFile,
} from '../../../../utils/deploy-utils';
import { DenJsonUpload, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the new Jones USDC Registry
 * - Deploys the new jUSDC Implementation contract
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const jUSDCTokenVaultV2Address = await deployContractAndSave(
    'JonesUSDCIsolationModeTokenVaultV2',
    [],
    undefined,
    core.libraries.tokenVaultActionsImpl,
  );
  const jonesUSDCRegistryAddress = await deployContractAndSave(
    'JonesUSDCRegistry',
    [],
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jonesUSDCV1RegistryProxy',
      'upgradeTo',
      [jonesUSDCRegistryAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jonesUSDCV1Registry',
      'ownerSetJUSDCFarm',
      [core.jonesEcosystem!.jUSDCFarm.address],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem!.live,
      'jUSDCV1IsolationModeFactory',
      'ownerSetUserVaultImplementation',
      [jUSDCTokenVaultV2Address],
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
