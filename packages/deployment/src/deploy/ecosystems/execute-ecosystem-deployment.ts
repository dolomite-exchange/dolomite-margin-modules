import { NetworkName } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { execSync } from 'child_process';
import path from 'path';
import * as process from 'process';

const ALL_NETWORKS = Object.values(NetworkName);

const ecosystemName = process.argv[2];
if (!ecosystemName) {
  throw new Error(`Invalid script number, found: ${ecosystemName}`);
}

const networkName = process.env.NETWORK;
if (!networkName || !ALL_NETWORKS.includes(networkName as any)) {
  throw new Error(`Invalid network name, found: ${networkName}. Expected one of ${ALL_NETWORKS.join(', ')}`);
}

const filePath = path.resolve(__dirname, `deploy-${ecosystemName}-ecosystem.ts`);
console.log('');
console.log('===========================================================');
console.log('==================== Executing Dry Run ====================');
console.log('===========================================================');
console.log('');
try {
  execSync(`NETWORK=${networkName} hardhat --network hardhat run ${filePath}`, { stdio: 'inherit' });
} catch (e) {
  console.error(e);
  process.exit(1);
}

console.log('');
console.log('===========================================================');
console.log('==================== Executing Real Run ===================');
console.log('===========================================================');
console.log('');
try {
  execSync(`hardhat --network ${networkName} run ${filePath}`, { stdio: 'inherit' });
} catch (e) {
  console.error(e);
  process.exit(1);
}
