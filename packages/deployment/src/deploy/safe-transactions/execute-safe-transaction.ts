import { NetworkName } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { execSync } from 'child_process';
import path from 'path';
import * as process from 'process';

const HARDHAT_RUN = `node --max-old-space-size=32768 ${process.cwd()}../../../node_modules/.bin/hardhat`;

const ALL_NETWORKS = Object.values(NetworkName);

const scriptNumber = parseInt(process.argv[2], 10);
if (isNaN(scriptNumber) || scriptNumber < 0) {
  throw new Error(`Invalid script number, found: ${scriptNumber}`);
}

const networkName = process.env.NETWORK;
if (!networkName || !ALL_NETWORKS.includes(networkName as any)) {
  throw new Error(`Invalid network name, found: ${networkName}. Expected one of ${ALL_NETWORKS.join(', ')}`);
}

const DRY_RUN_ONLY_KEY = '--dry-run-only';
const SKIP_DRY_RUN_KEY = '--skip-dry-run';
const dryRunOnly = process.argv.some((arg) => arg === DRY_RUN_ONLY_KEY) || process.env.DRY_RUN_ONLY === 'true';
const skipDryRun = process.argv.some((arg) => arg === SKIP_DRY_RUN_KEY) || process.env.SKIP_DRY_RUN === 'true';

const lowerBound = Math.floor(scriptNumber / 100) * 100;
const directory = `${lowerBound}-${lowerBound + 99}`;
const filePath = path.resolve(__dirname, networkName, directory, `safe-transaction-${scriptNumber}.ts`);

if (!skipDryRun) {
  console.log('');
  console.log('===========================================================');
  console.log('==================== Executing Dry Run ====================');
  console.log('===========================================================');
  console.log('');
  try {
    execSync(
      `NETWORK=${networkName} ${HARDHAT_RUN} --network hardhat run ${filePath}`,
      { stdio: 'inherit' },
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

if (!dryRunOnly) {
  console.log('');
  console.log('===========================================================');
  console.log('==================== Executing Real Run ===================');
  console.log('===========================================================');
  console.log('');
  try {
    execSync(
      `${HARDHAT_RUN} --network ${networkName} run ${filePath}`,
      { stdio: 'inherit' },
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
