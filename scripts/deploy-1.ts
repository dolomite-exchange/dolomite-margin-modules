import { ethers } from 'hardhat';
import { setupCoreProtocol } from '../src/utils/dolomite-utils';
import { deployContractAndSave } from './deploy-utils';


async function main() {
  const core = await setupCoreProtocol({
    blockNumber: 0,
  });
  const chainId = (await ethers.provider.getNetwork()).chainId
  await deployContractAndSave(chainId, '', []);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
