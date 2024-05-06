import { artifacts } from 'hardhat';
import { initializeFreshArtifactFromWorkspace, verifyContract } from './deploy-utils';

async function main() {
  const contractName = 'IsolationModeUpgradeableProxy';
  await initializeFreshArtifactFromWorkspace(contractName);
  const sourceName = artifacts.readArtifactSync(contractName).sourceName;
  const libraries = {};
  await verifyContract(
    '0x7a4cbd82b1568587422e086fed3cb386d1b18edc',
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
