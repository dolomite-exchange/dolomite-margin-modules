import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  IERC20,
  IERC20__factory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
} from '../src/types';
import axios from 'axios';

const IR_ADDRESS = '0xa1B644AEC990Ad6023811cED36E6A2d6D128C7C9';
const IR_CLAIMER_ADDRESS = '0x5F791523314ca809A1146184311e35001b6E6FC8';

const OWNER = '0x52256ef863a713Ef349ae6E97A7E8f35785145dE';
const METAVAULT = '0x76F103037601a2a8f042Caa259C55abbb34e30EB';

describe('InfraredBGTMetaVault', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let metavault: InfraredBGTMetaVault;
  let ir: IERC20;

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
      [IR_ADDRESS, IR_CLAIMER_ADDRESS],
    );
    await core.berachainRewardsEcosystem.live.registry.connect(core.governance).ownerSetMetaVaultImplementation(
      implementation.address,
    );

    user = await impersonate(OWNER, true);
    metavault = InfraredBGTMetaVault__factory.connect(METAVAULT, user);
    ir = IERC20__factory.connect(IR_ADDRESS, user);

    response = await axios.get('https://infrared.finance/api/airdrop/0x76F103037601a2a8f042Caa259C55abbb34e30EB?chainId=80094');

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#claimIRAirdrop', () => {
    it('should work normally', async () => {
      await expect(() => metavault.claimIRAirdrop(response.data.amount, response.data.proof))
        .to.changeTokenBalance(ir, user.address, response.data.amount);
    });

    it('should fail if proof is invalid', async () => {
      response.data.proof[0] = '0x88ff06e733f34d3e128569ec41af12013cdc464600574c4eacce58a9f87f4780';
      await expectThrow(metavault.claimIRAirdrop(response.data.amount, response.data.proof));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        metavault.connect(core.hhUser1).claimIRAirdrop(response.data.amount, response.data.proof),
        `InfraredBGTMetaVault: Only owner can call <${core.hhUser1.addressLower}>`,
      );
    });
  });
});
