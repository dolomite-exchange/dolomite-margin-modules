import fs from 'fs';
import { sortFile, writeFile } from './deploy-utils';

async function main() {
  const fileBuffer = fs.readFileSync('./scripts/deployments.json');
  const file = JSON.parse(fileBuffer.toString());
  writeFile(sortFile(file));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
