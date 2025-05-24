import { artifacts } from 'hardhat';
import { initializeFreshArtifactFromWorkspace, verifyContract } from './deploy-utils';

async function main() {
  const contractName = 'MetaVaultUpgradeableProxy';
  await initializeFreshArtifactFromWorkspace(contractName);
  const sourceName = artifacts.readArtifactSync(contractName).sourceName;
  const libraries = {};
  await verifyContract(
    '0x76F103037601a2a8f042Caa259C55abbb34e30EB',
    [],
    `${sourceName}:${contractName}`,
    libraries,
    0,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
