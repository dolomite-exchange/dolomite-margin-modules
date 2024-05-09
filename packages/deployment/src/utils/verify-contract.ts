import { artifacts } from 'hardhat';
import { initializeFreshArtifactFromWorkspace, verifyContract } from './deploy-utils';

async function main() {
  const contractName = 'IsolationModeUpgradeableProxy';
  await initializeFreshArtifactFromWorkspace(contractName);
  const sourceName = artifacts.readArtifactSync(contractName).sourceName;
  const libraries = {};
  await verifyContract(
    '0x3A92Bde1D47d57cC4D32E46E9dF12D0bcD2A2a36',
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
