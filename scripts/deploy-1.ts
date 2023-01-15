import { ethers } from 'hardhat';
import { deployContractAndSave } from './deploy-utils';


async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  await deployContractAndSave(chainId, '', []);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
