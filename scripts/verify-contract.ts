import { verifyContract } from './deploy-utils';

/**
 * Deploys the GMX ecosystem smart contracts to the current network.
 */
async function main() {
  await verifyContract(
    '0x275ce1229F4944ED7d04095E437880684A789b5f',
    [],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
