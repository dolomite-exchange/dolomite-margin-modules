import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { readFileSync } from 'fs';
import { writeFile } from 'fs-extra';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { InfraredBGTMetaVault__factory } from 'packages/berachain/src/types';
import hardhat from 'hardhat';

const VAULTS_PATH = `${__dirname}/../../../../berachain/infrared-vaults-airdrop.json`;

async function main() {
  const network = Network.Berachain;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const allUsers = JSON.parse(readFileSync(VAULTS_PATH).toString()) as any[];
  for (const user of allUsers) {
    if (!user['isEligible'] || user['executed']) {
      continue;
    }

    const metavault = InfraredBGTMetaVault__factory.connect(user['metavault'], core.hhUser1);
    try {
      const transaction = await metavault.connect(core.hhUser1).claimIRAirdrop(user['airdrop_amount'], user['airdrop_proof']);
      const receipt = await transaction.wait();

      if (!receipt.status) {
        user['failure'] = true;
      } else {
        delete user['failure'];
        user['executed'] = true;
      }
    } catch (e: any) {
      user['executed'] = false;
      user['failure'] = true;
    }

    if (hardhat.network.name !== 'hardhat') {
      await writeFile(VAULTS_PATH, JSON.stringify(allUsers, null, 2));
    }

    console.log(`Airdropped ${user['owner']}`);
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
