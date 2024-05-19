import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { OARB, RewardsDistributor } from '../src/types';
import { createOARB, createRewardsDistributor } from './liquidity-mining-ecosystem-utils';

const USER1 = '0x0321be949876c2545ac121379c620c2a0480b758';
const USER2 = '0x1702acf734116cd8faf86d139aa91843f81510a1';

describe('RewardsDistributorIntegration', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let oARB: OARB;
  let rewardsDistributor: RewardsDistributor;
  let merkleRoot1: string;
  let validProof1: string[];
  let validProof2: string[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createOARB(core);
    rewardsDistributor = await createRewardsDistributor(core, oARB, [core.hhUser5.address]);
    await core.dolomiteMargin.ownerSetGlobalOperator(rewardsDistributor.address, true);

    merkleRoot1 = '0x9d5f7ae4fabaf5a6425cfd830814e1cafa1c28c9be28c07366ff488af1a84e8b';
    validProof1 = [
      '0x54b08bab290ab198d3ad792784163f3395d516b459604cbeab5099e14683cb1a',
      '0xa27b9dfbcffb8eb0ffd6cf0ceee05200dc8b55c2d8d50556cbd91434d091af5b',
      '0x3f4321f91ea8f1e898f305b20c4395371b58d925a088152d5d50ad2a5e472d6a',
    ];
    validProof2 = [
      '0xd89d0d59610da141f8c2ae808d945ab1e4e7e53ccdc50ab4171e8e15c63584da',
      '0x8057fd79c67c1e40e80485281c1ac3f7039fc3a4bd9f63a9d9e5bfacaeac0353',
      '0xb8d42e7277d449205bc2c2009784b5bb6cf557e3f08d5c1fdd1b3cd7ebc1bae0',
    ];

    await rewardsDistributor.connect(core.governance).ownerSetMerkleRoot(1, merkleRoot1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await rewardsDistributor.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await rewardsDistributor.oARB()).to.eq(oARB.address);
    });
  });

  describe('#claim', () => {
    it('should work normally', async () => {
      const user1 = await impersonate(USER1, true);
      await rewardsDistributor.connect(user1).claim([{ epoch: 1, amount: parseEther('1000'), proof: validProof1 }]);
      expect(await oARB.balanceOf(user1.address)).to.eq(parseEther('1000'));
      expect(await rewardsDistributor.getClaimStatusByUserAndEpoch(user1.address, 1)).to.be.true;

      const user2 = await impersonate(USER2, true);
      await rewardsDistributor.connect(user2).claim([{ epoch: 1, amount: parseEther('2250'), proof: validProof2 }]);
      expect(await oARB.balanceOf(user2.address)).to.eq(parseEther('2250'));
      expect(await rewardsDistributor.getClaimStatusByUserAndEpoch(user2.address, 1)).to.be.true;
    });

    it('should fail with incorrect amount', async () => {
      const user1 = await impersonate(USER1, true);
      await expectThrow(
        rewardsDistributor.connect(user1).claim([{ epoch: 1, amount: parseEther('2000'), proof: validProof1 }]),
        'RewardsDistributor: Invalid merkle proof',
      );
    });

    it('should fail with invalid user', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser1).claim([{ epoch: 1, amount: parseEther('1000'), proof: validProof1 }]),
        'RewardsDistributor: Invalid merkle proof',
      );
    });

    it('should fail if tokens already claimed', async () => {
      const user1 = await impersonate(USER1, true);
      await rewardsDistributor.connect(user1).claim([{ epoch: 1, amount: parseEther('1000'), proof: validProof1 }]);
      await expectThrow(
        rewardsDistributor.connect(user1).claim([{ epoch: 1, amount: parseEther('1000'), proof: validProof1 }]),
        'RewardsDistributor: Already claimed',
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        rewardsDistributor.connect(core.hhUser3).claim([{ epoch: 1, amount: parseEther('1000'), proof: validProof1 }]),
        'RewardsDistributor: Invalid merkle proof',
      );
    });
  });
});
