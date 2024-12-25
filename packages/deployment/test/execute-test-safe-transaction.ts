import { NetworkName } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { execSync } from 'child_process';
import path from 'path';
import * as process from 'process';

const ALL_NETWORKS = Object.values(NetworkName);

const scriptNumber = parseInt(process.argv[2], 10);
if (isNaN(scriptNumber) || scriptNumber < 0) {
  throw new Error(`Invalid script number, found: ${scriptNumber}`);
}

const networkName = process.env.NETWORK;
if (!networkName || !ALL_NETWORKS.includes(networkName as any)) {
  throw new Error(`Invalid network name, found: ${networkName}. Expected one of ${ALL_NETWORKS.join(', ')}`);
}

const filePath = path.resolve(__dirname, networkName, `safe-transaction-${scriptNumber}.ts`);
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
