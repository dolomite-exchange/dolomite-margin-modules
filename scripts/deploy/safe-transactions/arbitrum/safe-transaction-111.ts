import deployments from '../../../../scripts/deployments.json';
import { OARB__factory, RewardsDistributor__factory } from '../../../../src/types';
import { getRewardsDistributorConstructorParams } from '../../../../src/utils/constructors/liquidity-mining';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { BYTES_ZERO, Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../deploy-utils';

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
    getRewardsDistributorConstructorParams(core, oARB),
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
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
