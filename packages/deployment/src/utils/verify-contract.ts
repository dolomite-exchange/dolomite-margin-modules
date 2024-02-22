import { artifacts } from 'hardhat';
import { verifyContract } from './deploy-utils';

async function main() {
  const contractName = 'IsolationModeUpgradeableProxy';
  const sourceName = (await artifacts.readArtifact(contractName)).sourceName;
  const libraries = {};
  await verifyContract(
    '0x48e0b8026e08676689468F1DcF43203698Ff26A0',
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
