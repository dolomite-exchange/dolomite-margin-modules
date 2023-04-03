import { verifyContract } from './deploy-utils';

/**
 * Deploys the GMX ecosystem smart contracts to the current network.
 */
async function main() {
  await verifyContract(
    '0xb56d350b2c92156421c1f4795f6b3de5e108829f',
    [],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
