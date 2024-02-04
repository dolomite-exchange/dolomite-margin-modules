import { ethers } from 'hardhat';
import { getParaswapAggregatorTraderConstructorParams } from '../../../packages/base/src/utils/constructors/traders';
import { getAnyNetwork } from '../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../packages/base/test/utils/setup';
import { deployContractAndSave } from '../../deploy-utils';

async function main() {
  const network = await getAnyNetwork();
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  await deployContractAndSave(
    Number(network),
    'ParaswapAggregatorTraderV2',
    getParaswapAggregatorTraderConstructorParams(core),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
