import { artifacts } from 'hardhat';
import { initializeFreshArtifactFromWorkspace, verifyContract } from './deploy-utils';

async function main() {
  const contractName = 'IsolationModeUpgradeableProxy';
  await initializeFreshArtifactFromWorkspace(contractName);
  const sourceName = artifacts.readArtifactSync(contractName).sourceName;
  const libraries = {};
  await verifyContract(
    '0x2A0c9632B1F75d78F6b1F175Ed222EC77c2b11De',
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
