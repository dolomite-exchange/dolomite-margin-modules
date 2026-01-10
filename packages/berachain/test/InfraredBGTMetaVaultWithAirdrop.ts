import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
} from '../src/types';
import axios from 'axios';
import { readFileSync } from 'fs';
import { writeFile } from 'fs-extra';
import { formatEther } from 'ethers/lib/utils';

const OWNER = '0x52256ef863a713Ef349ae6E97A7E8f35785145dE';
const METAVAULT = '0x76F103037601a2a8f042Caa259C55abbb34e30EB';

const VAULTS_PATH = `${__dirname}/../infrared-vaults-airdrop.json`;

describe('InfraredBGTMetaVaultWithAirdrop', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let metavault: InfraredBGTMetaVault;

  let user: SignerWithAddressWithSafety;
  let response: any;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 14_495_000,
      network: Network.Berachain,
    });

    const implementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [core.tokens.ir.address, core.berachainRewardsEcosystem.infraredMerkleDistributor.address, core.hhUser5.address],
    );
    await core.berachainRewardsEcosystem.live.registry.connect(core.governance).ownerSetMetaVaultImplementation(
      implementation.address,
    );

    user = await impersonate(OWNER, true);
    metavault = InfraredBGTMetaVault__factory.connect(METAVAULT, user);

    response = await axios.get('https://infrared.finance/api/airdrop/0x76F103037601a2a8f042Caa259C55abbb34e30EB?chainId=80094');

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#claimIRAirdrop', () => {
    it('should work normally', async () => {
      await expect(() => metavault.connect(core.hhUser5).claimIRAirdrop(response.data.amount, response.data.proof))
        .to.changeTokenBalance(core.tokens.ir, user.address, response.data.amount);
    });

    it('should fail if proof is invalid', async () => {
      response.data.proof[0] = '0x88ff06e733f34d3e128569ec41af12013cdc464600574c4eacce58a9f87f4780';
      await expectThrow(metavault.connect(core.hhUser5).claimIRAirdrop(response.data.amount, response.data.proof));
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        metavault.connect(user).claimIRAirdrop(response.data.amount, response.data.proof),
        'InfraredBGTMetaVault: Only handler can call',
      );
    });
  });

  describe('json', () => {
    it('should populate info', async () => {
      const registry = core.berachainRewardsEcosystem.live.registry;

      const allUsers = JSON.parse(readFileSync(VAULTS_PATH).toString()) as any[];
      for (const user of allUsers) {
        const metavault = await registry.getMetaVaultByAccount(user['owner']);
        if (metavault === ADDRESS_ZERO) {
          user['metavault'] = '';
          user['isEligible'] = false;
          continue;
        }
        user['metavault'] = await registry.getMetaVaultByAccount(user['owner']);

        const response = await axios.get(`https://infrared.finance/api/airdrop/${metavault}?chainId=80094`);
        if (response.data) {
          user['airdrop_amount'] = response.data.amount;
          user['airdrop_proof'] = response.data.proof;
          user['isEligible'] = true;
        } else {
          user['isEligible'] = false;
        }
      }

      await writeFile(VAULTS_PATH, JSON.stringify(allUsers, null, 2));
    });

    it('should airdrop', async () => {
      const allUsers = JSON.parse(readFileSync(VAULTS_PATH).toString()) as any[];
      for (const user of allUsers) {
        if (!user['isEligible'] || user['executed']) {
          continue;
        }

        const metavault = InfraredBGTMetaVault__factory.connect(user['metavault'], core.hhUser1);
        await expect(() => metavault.connect(core.hhUser5).claimIRAirdrop(
          user['airdrop_amount'],
          user['airdrop_proof']
        )).to.changeTokenBalance(core.tokens.ir, user['owner'], user['airdrop_amount']);
        console.log(`Airdropped ${user['owner']}`);
        console.log(formatEther(user['airdrop_amount']));
        console.log();
      }
    });
  });
});
