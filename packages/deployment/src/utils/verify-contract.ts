import { artifacts } from 'hardhat';
import { initializeFreshArtifactFromWorkspace, verifyContract } from './deploy-utils';

async function main() {
  const contractName = 'IsolationModeUpgradeableProxy';
  await initializeFreshArtifactFromWorkspace(contractName);
  const sourceName = artifacts.readArtifactSync(contractName).sourceName;
  const libraries = {};
  await verifyContract(
    '0x5CE275D694fCbc9Ede182c2Ea75D678Ad6280dEb',
    [],
    `${sourceName}:${contractName}`,
    libraries,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
