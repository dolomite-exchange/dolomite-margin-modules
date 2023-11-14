import fs from 'fs';
import { writeDeploymentFile } from './deploy-utils';

async function main() {
  const fileBuffer = fs.readFileSync('./scripts/deployments.json');
  const file = JSON.parse(fileBuffer.toString());
  writeDeploymentFile(file);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
