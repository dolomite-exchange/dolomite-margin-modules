import { verifyContract } from './deploy-utils';

async function main() {
  await verifyContract(
    '0x5c851fd710b83705be1cabf9d6cbd41f3544be0e',
    [],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
