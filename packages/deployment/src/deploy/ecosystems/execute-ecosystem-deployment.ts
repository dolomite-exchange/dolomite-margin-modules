import { NetworkName } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { execSync } from 'child_process';
import path from 'path';
import * as process from 'process';

const HARDHAT_RUN = `node --max-old-space-size=32768 ${process.cwd()}../../../node_modules/.bin/hardhat`;

const ALL_NETWORKS = Object.values(NetworkName);

const ecosystemName = process.argv[2];
if (!ecosystemName) {
  throw new Error(`Invalid script name, found: ${ecosystemName}`);
}

const DEPLOY_ALL_NETWORKS_KEY = '--all-networks';
const DRY_RUN_ONLY_KEY = '--dry-run-only';
const SKIP_DRY_RUN_KEY = '--skip-dry-run';
const allNetworks = process.argv.some((arg) => arg === DEPLOY_ALL_NETWORKS_KEY) || process.env.ALL_NETWORKS === 'true';
const dryRunOnly = process.argv.some((arg) => arg === DRY_RUN_ONLY_KEY) || process.env.DRY_RUN_ONLY === 'true';
const skipDryRun = process.argv.some((arg) => arg === SKIP_DRY_RUN_KEY) || process.env.SKIP_DRY_RUN === 'true';

let networkNames: string[];
if (allNetworks) {
  networkNames = ALL_NETWORKS;
} else {
  const networkName = process.env.NETWORK;
  if ((!networkName || !ALL_NETWORKS.includes(networkName as any) && !ecosystemName.includes('ethereum'))) {
    throw new Error(`Invalid NETWORK name, found: ${networkName}. Expected one of ${ALL_NETWORKS.join(', ')}`);
  }
  networkNames = [networkName];
}

networkNames.forEach((networkName) => {
  const filePath = path.resolve(__dirname, `deploy-${ecosystemName}-ecosystem.ts`);
  if (!skipDryRun) {
    console.log('');
    console.log(`===========================================================${'='.repeat(4 + networkName.length)}`);
    console.log(`==================== Executing Dry Run (${networkName}) ====================`);
    console.log(`===========================================================${'='.repeat(4 + networkName.length)}`);
    console.log('');
    try {
      execSync(`NETWORK=${networkName}  ${HARDHAT_RUN} --network hardhat run ${filePath}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }

  if (!dryRunOnly) {
    console.log('');
    console.log(`===========================================================${'='.repeat(4 + networkName.length)}`);
    console.log(`==================== Executing Real Run (${networkName}) ====================`);
    console.log(`===========================================================${'='.repeat(4 + networkName.length)}`);
    console.log('');
    try {
      execSync(`NETWORK=${networkName} ${HARDHAT_RUN} --network ${networkName} run ${filePath}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }
});
