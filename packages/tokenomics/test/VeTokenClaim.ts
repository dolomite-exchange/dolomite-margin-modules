import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_WEEK_SECONDS } from 'packages/base/src/utils/no-deps-constants';
import { advanceByTimeDelta, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { DOLO, TestVeTokenClaim, TestVeTokenClaim__factory, VotingEscrow } from '../src/types';

const END_TIMESTAMP = Math.floor(1801872000 / ONE_WEEK_SECONDS) * ONE_WEEK_SECONDS;
const EPOCH = 0;

describe('VeTokenClaim', () => {
  let core: CoreProtocolBerachain;
  let veTokenClaim: TestVeTokenClaim;

  let dolo: DOLO;
  let veDOLO: VotingEscrow;

  let merkleRoot: string;
  let validProof1: string[];
  let validProof2: string[];
  let invalidProof: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_403_500,
      network: Network.Berachain,
    });
    dolo = core.tokenomics.dolo;
    veDOLO = core.tokenomics.veDolo;

    const rewardsUsdc = [
      { address: core.hhUser1.address, rewards: parseEther('5') },
      { address: core.hhUser2.address, rewards: parseEther('10') },
    ];
    const leavesUsdc = rewardsUsdc.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const invalidLeaf = keccak256(
      defaultAbiCoder.encode(['address', 'uint256'], [core.hhUser3.address, parseEther('15')]),
    );
    const treeUsdc = new MerkleTree(leavesUsdc, keccak256, { sort: true });

    merkleRoot = treeUsdc.getHexRoot();
    validProof1 = treeUsdc.getHexProof(leavesUsdc[0]);
    validProof2 = treeUsdc.getHexProof(leavesUsdc[1]);
    invalidProof = treeUsdc.getHexProof(invalidLeaf);

    veTokenClaim = await createContractWithAbi<TestVeTokenClaim>(
      TestVeTokenClaim__factory.abi,
      TestVeTokenClaim__factory.bytecode,
      [dolo.address, veDOLO.address, core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    await veTokenClaim.connect(core.governance).ownerSetMerkleRoot(merkleRoot);
    await veTokenClaim.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(veTokenClaim.address, true);

    await dolo.connect(core.gnosisSafe).transfer(veTokenClaim.address, parseEther('65'));
    await veTokenClaim.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await veTokenClaim.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await veTokenClaim.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await veTokenClaim.DOLO()).to.eq(core.tokenomics.dolo.address);
      expect(await veTokenClaim.VE_DOLO()).to.eq(core.tokenomics.veDolo.address);
    });
  });

  describe('#claim', () => {
    it('should work normally with one marketId and then the next', async () => {
      let tokenId = (await veDOLO.tokenId()).add(1);
      const res = await veTokenClaim.connect(core.hhUser1).claim(parseEther('5'), validProof1);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: EPOCH,
        amount: parseEther('5'),
      });
      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('5'));
      expect((await veDOLO.locked(tokenId)).end).to.eq(END_TIMESTAMP);

      tokenId = tokenId.add(1);
      const res2 = await veTokenClaim.connect(core.hhUser2).claim(parseEther('10'), validProof2);
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser2.address,
        epoch: EPOCH,
        amount: parseEther('10'),
      });
      expect(await veTokenClaim.userToClaimStatus(core.hhUser2.address)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('10'));
      expect((await veDOLO.locked(tokenId)).end).to.eq(END_TIMESTAMP);
    });

    it('should work normally if user has address remapping', async () => {
      const tokenId = (await veDOLO.tokenId()).add(1);
      await veTokenClaim.connect(core.hhUser5).ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);
      const res = await veTokenClaim.connect(core.hhUser4).claim(parseEther('5'), validProof1);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: EPOCH,
        amount: parseEther('5'),
      });

      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('5'));
      expect((await veDOLO.locked(tokenId)).end).to.eq(END_TIMESTAMP);
      expect(await veDOLO.ownerOf(tokenId)).to.eq(core.hhUser4.address);
    });

    it('should work normally if time moves forward', async () => {
      await advanceByTimeDelta(86_400 * 365);
      const tokenId = (await veDOLO.tokenId()).add(1);
      await veTokenClaim.connect(core.hhUser5).ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);
      const res = await veTokenClaim.connect(core.hhUser4).claim(parseEther('5'), validProof1);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: EPOCH,
        amount: parseEther('5'),
      });

      expect(await veTokenClaim.userToClaimStatus(core.hhUser1.address)).to.be.true;
      expect((await veDOLO.locked(tokenId)).amount).to.eq(parseEther('5'));
      expect((await veDOLO.locked(tokenId)).end).to.eq(END_TIMESTAMP);
      expect(await veDOLO.ownerOf(tokenId)).to.eq(core.hhUser4.address);
    });

    it('should fail if 2 years are up', async () => {
      await advanceByTimeDelta(86_400 * 730);
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).claim(parseEther('5'), validProof1),
        'VeTokenClaim: Past max claim period',
      );
    });

    it('should fail if claim is not enabled', async () => {
      await veTokenClaim.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).claim(parseEther('5'), validProof1),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should fail if remapped user trys to claim again from original address', async () => {
      await veTokenClaim.connect(core.hhUser5).ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);
      const res = await veTokenClaim.connect(core.hhUser4).claim(parseEther('5'), validProof1);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: EPOCH,
        amount: parseEther('5'),
      });
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).claim(parseEther('5'), validProof1),
        'VeTokenClaim: User already claimed',
      );
    });

    it('should fail if original user trys to claim again from remapped address', async () => {
      await veTokenClaim.connect(core.hhUser5).ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);
      const res = await veTokenClaim.connect(core.hhUser1).claim(parseEther('5'), validProof1);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: veTokenClaim.address,
        user: core.hhUser1.address,
        epoch: EPOCH,
        amount: parseEther('5'),
      });
      await expectThrow(
        veTokenClaim.connect(core.hhUser4).claim(parseEther('5'), validProof1),
        'VeTokenClaim: User already claimed',
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        veTokenClaim.connect(core.hhUser3).claim(parseEther('15'), invalidProof),
        'VeTokenClaim: Invalid merkle proof',
      );
    });

    it('should fail if user has already claimed', async () => {
      await veTokenClaim.connect(core.hhUser1).claim(parseEther('5'), validProof1);
      await expectThrow(
        veTokenClaim.connect(core.hhUser1).claim(parseEther('5'), validProof1),
        'VeTokenClaim: User already claimed',
      );
    });

    it('should fail if reentered', async () => {
      const data = await veTokenClaim.populateTransaction.claim(parseEther('5'), validProof1);
      await expectThrow(
        veTokenClaim.callFunctionAndTriggerReentrancy(data.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });
});
