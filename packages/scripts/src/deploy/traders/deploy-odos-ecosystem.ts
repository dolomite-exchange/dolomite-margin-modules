import { ethers } from 'hardhat';
import { getOdosAggregatorTraderConstructorParams } from '../../../packages/base/src/utils/constructors/traders';
import { getAndCheckSpecificNetwork, getAnyNetwork } from '../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../packages/base/test/utils/setup';
import { deployContractAndSave } from '../../deploy-utils';

async function main() {
  const network = await getAnyNetwork();
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  await deployContractAndSave(
    Number(network),
    'OdosAggregatorTrader',
    getOdosAggregatorTraderConstructorParams(core),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
