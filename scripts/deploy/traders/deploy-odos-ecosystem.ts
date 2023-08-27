import { ethers } from 'hardhat';
import { Network } from '../../../src/utils/no-deps-constants';
import { getOdosAggregatorTraderConstructorParams } from '../../../src/utils/constructors/traders';
import { setupCoreProtocol } from '../../../test/utils/setup';
import { deployContractAndSave } from '../../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
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
