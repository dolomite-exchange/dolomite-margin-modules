import { NetworkName } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { execSync } from 'child_process';
import path from 'path';
import * as process from 'process';
import { getCommandlineArg } from '../../utils/cmd-utils';

const HARDHAT_RUN = `node --max-old-space-size=32768 ${process.cwd()}../../../node_modules/.bin/hardhat`;

const ALL_NETWORKS = Object.values(NetworkName);

const nonce = parseInt(process.argv[2], 10);
if (isNaN(nonce) || nonce < 0) {
  throw new Error(`Invalid script number, found: ${nonce}`);
}

const networkName = getCommandlineArg('--network');
if (!networkName || !ALL_NETWORKS.includes(networkName as any)) {
  throw new Error(`Invalid network name, found: ${networkName}. Expected one of ${ALL_NETWORKS.join(', ')}`);
}

const filePath = path.resolve(__dirname, 'get-transaction-ids.ts');

console.log('');
console.log('===========================================================');
console.log('============== Executing Get Transaction Ids ==============');
console.log('===========================================================');
console.log('');
try {
  const startTimestamp = Date.now();
  execSync(
    `NONCE=${nonce} ${HARDHAT_RUN} --network ${networkName} run ${filePath}`,
    { stdio: 'inherit' },
  );
  const duration = Math.floor((Date.now() - startTimestamp) / 1000);
  console.log(`\tFinished real run in ${duration}s`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
