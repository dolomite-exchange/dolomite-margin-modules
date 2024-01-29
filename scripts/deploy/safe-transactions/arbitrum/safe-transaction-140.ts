import {
  getVesterImplementationConstructorParams,
} from '@dolomite-exchange/modules-liquidity-mining/src/liquidity-mining-constructors';
import { ethers } from 'ethers';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';

const handler = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe';

/**
 * This script encodes the following transactions:
 * - Deploys the new VesterImplementationV2 contract + library
 * - Deploys the new jUSDC Implementation contract
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const libAddress = await deployContractAndSave(
    Number(network),
    'VesterImplementationLibForV2',
    [],
  );
  const implementationAddress = await deployContractAndSave(
    Number(network),
    'VesterImplementationV2',
    getVesterImplementationConstructorParams(core),
    undefined,
    { VesterImplementationLibForV2: libAddress },
  );

  const calldata = await core.liquidityMiningEcosystem!.oArbVester.populateTransaction.initialize(
    ethers.utils.defaultAbiCoder.encode(['address'], [handler]),
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.liquidityMiningEcosystem!,
      'oArbVesterProxy',
      'upgradeToAndCall',
      [implementationAddress, calldata.data!],
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
