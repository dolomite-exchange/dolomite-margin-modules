import { verifyContract } from './deploy-utils';

async function main() {
  await verifyContract(
    '0x854a031446860561d5224bc4e558eda4c2b31b12',
    [],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
