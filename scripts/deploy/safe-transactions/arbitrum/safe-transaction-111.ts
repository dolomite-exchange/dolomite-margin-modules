import deployments from '../../../../scripts/deployments.json';
import { OARB__factory, RewardsDistributor__factory } from '../../../../src/types';
import { getRewardsDistributorConstructorParams } from '@dolomite-exchange/modules-liquidity-mining/src/types/liquidity-mining';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import {
  createFolder,
  deployContractAndSave,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Creates the RewardsDistributor contract
 * - Allows the delayed multisig to invoke `ownerSetMerkleRoot` instantly on the RewardsDistributor contract
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const oARB = OARB__factory.connect(deployments.OARB[network].address, core.hhUser1);
  const rewardsDistributorAddress = await deployContractAndSave(
    Number(network),
    'RewardsDistributor',
    getRewardsDistributorConstructorParams(
      core,
      oARB,
      ['0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761', '0xbDEf2b2051E2aE113297ee8301e011FD71A83738'],
    ),
    'OARBRewardsDistributor',
  );
  const rewardsDistributor = RewardsDistributor__factory.connect(rewardsDistributorAddress, core.hhUser1);

  const transaction = await rewardsDistributor.populateTransaction.ownerSetMerkleRoot(1, BYTES_ZERO);
  const selector = transaction.data!.slice(0, 10);
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'delayedMultiSig',
    'setSelector',
    [rewardsDistributor.address, selector, true],
  );
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
