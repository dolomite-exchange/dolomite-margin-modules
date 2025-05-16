import {
  DOLO,
  ODOLO,
  TestRollingClaims,
  TestRollingClaims__factory,
} from '../src/types';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';

describe('RollingClaims', () => {
  let core: CoreProtocolBerachain;
  let rollingClaims: TestRollingClaims;

  let odolo: ODOLO;

  let merkleRoot: string;
  let validProof1: string[];
  let invalidProof: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_403_500,
      network: Network.Berachain
    });
    odolo = core.tokenomics.oDolo;

    const rewards = [
      { address: core.hhUser1.address, rewards: parseEther('5') },
      { address: core.hhUser2.address, rewards: parseEther('10') },
    ];
    const leaves = rewards.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const invalidLeaf = keccak256(defaultAbiCoder.encode(
      ['address', 'uint256'],
      [core.hhUser3.address, parseEther('15')]
    ));
    const tree = new MerkleTree(leaves, keccak256, { sort: true });

    merkleRoot = tree.getHexRoot();
    validProof1 = tree.getHexProof(leaves[0]);
    invalidProof = tree.getHexProof(invalidLeaf);

    rollingClaims = await createContractWithAbi<TestRollingClaims>(
      TestRollingClaims__factory.abi,
      TestRollingClaims__factory.bytecode,
      [odolo.address, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await rollingClaims.connect(core.governance).ownerSetMerkleRoot(merkleRoot);
    await rollingClaims.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(rollingClaims.address, true);

    await odolo.connect(core.governance).ownerMint(parseEther('100'));
    await odolo.connect(core.governance).transfer(rollingClaims.address, parseEther('100'));
    await rollingClaims.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await rollingClaims.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await rollingClaims.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await rollingClaims.ODOLO()).to.eq(core.tokenomics.oDolo.address);
    });
  });

  describe('#claim', () => {
    it('should work normally with first merkle root', async () => {
      const res = await rollingClaims.connect(core.hhUser1).claim(validProof1, parseEther('5'));
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: 0,
        amount: parseEther('5')
      });
      expect(await rollingClaims.userToClaimAmount(core.hhUser1.address)).to.eq(parseEther('5'));
      expect(await odolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('5'));
    });

    it('should work normally with remapped address', async () => {
      await rollingClaims.connect(core.hhUser5).ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);

      const res = await rollingClaims.connect(core.hhUser4).claim(validProof1, parseEther('5'));
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: 0,
        amount: parseEther('5')
      });
      expect(await rollingClaims.userToClaimAmount(core.hhUser1.address)).to.eq(parseEther('5'));
      expect(await odolo.balanceOf(core.hhUser4.address)).to.eq(parseEther('5'));

      await expectThrow(
        rollingClaims.connect(core.hhUser1).claim(validProof1, parseEther('5')),
        'RollingClaims: No amount to claim'
      );
      await expectThrow(
        rollingClaims.connect(core.hhUser4).claim(validProof1, parseEther('5')),
        'RollingClaims: No amount to claim'
      );
    });

    it('should work normally with two merkle roots', async () => {
      const res = await rollingClaims.connect(core.hhUser1).claim(validProof1, parseEther('5'));
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: 0,
        amount: parseEther('5')
      });
      expect(await rollingClaims.userToClaimAmount(core.hhUser1.address)).to.eq(parseEther('5'));
      expect(await odolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('5'));

      const rewards = [
        { address: core.hhUser1.address, rewards: parseEther('20') },
        { address: core.hhUser2.address, rewards: parseEther('25') },
      ];
      const leaves = rewards.map((account) =>
        keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
      );
      const tree = new MerkleTree(leaves, keccak256, { sort: true });
      const newMerkleRoot = tree.getHexRoot();
      const newValidProof = tree.getHexProof(leaves[0]);
      const newValidProof2 = tree.getHexProof(leaves[1]);

      await rollingClaims.connect(core.governance).ownerSetMerkleRoot(newMerkleRoot);
      const res2 = await rollingClaims.connect(core.hhUser1).claim(newValidProof, parseEther('20'));
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser1.address,
        epoch: 0,
        amount: parseEther('15')
      });
      expect(await rollingClaims.userToClaimAmount(core.hhUser1.address)).to.eq(parseEther('20'));
      expect(await odolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('20'));

      const res3 = await rollingClaims.connect(core.hhUser2).claim(newValidProof2, parseEther('25'));
      await expectEvent(core.eventEmitterRegistry, res3, 'RewardClaimed', {
        distributor: rollingClaims.address,
        user: core.hhUser2.address,
        epoch: 0,
        amount: parseEther('25')
      });
      expect(await rollingClaims.userToClaimAmount(core.hhUser2.address)).to.eq(parseEther('25'));
      expect(await odolo.balanceOf(core.hhUser2.address)).to.eq(parseEther('25'));
    });

    it('should fail if claim is not enabled', async () => {
      await rollingClaims.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        rollingClaims.connect(core.hhUser1).claim(validProof1, parseEther('5')),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        rollingClaims.connect(core.hhUser3).claim(invalidProof, parseEther('15')),
        'RollingClaims: Invalid merkle proof'
      );
    });

    it('should fail if user has already claimed full amount', async () => {
      await rollingClaims.connect(core.hhUser1).claim(validProof1, parseEther('5'));
      await expectThrow(
        rollingClaims.connect(core.hhUser1).claim(validProof1, parseEther('5')),
        'RollingClaims: No amount to claim'
      );
    });

    it('should fail if reentered', async () => {
      const data = await rollingClaims.populateTransaction.claim(validProof1, parseEther('5'));
      await expectThrow(
        rollingClaims.callFunctionAndTriggerReentrancy(data.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });
});
