import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  createFolder,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../utils/deploy-utils';
import { DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2024)
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2025)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const VesterImplementationLibForV2Address = await deployContractAndSave(
    'VesterImplementationLibForV2',
    [],
    'VesterImplementationLibForV3',
  );
  const vesterAddress = await deployContractAndSave(
    'VesterImplementationV2',
    [],
    'VesterImplementationV3',
    { VesterImplementationLibForV2: VesterImplementationLibForV2Address },
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.liquidityMiningEcosystem,
      'oArbVesterProxy',
      'upgradeTo',
      [vesterAddress],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      const OLD_DURATION = '';
      const NEW_DURATION = 86_400 * 7 * 40; // 40 weeks
      const nftId = '';
      assertHardhatInvariant(
        (await core.liquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(OLD_DURATION),
        'Invalid duration before',
      );

      const signer = await impersonate('');
      await core.liquidityMiningEcosystem.oArbVesterV2.connect(signer)
        .extendDurationForPosition(nftId, NEW_DURATION);

      assertHardhatInvariant(
        (await core.liquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(NEW_DURATION),
        'Invalid duration after',
      );
    },
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
