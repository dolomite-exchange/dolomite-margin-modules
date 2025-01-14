import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { DOLO, VestingClaims } from '../src/types';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createDOLO, createVestingClaims } from './tokenomics-ecosystem-utils';
import { Network, ONE_DAY_SECONDS, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { ethers } from 'hardhat';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber } from 'ethers';

const TEST_TGE_TIMESTAMP = 1730000000;
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS;
const DURATION = ONE_YEAR_SECONDS * 3;
const HALFWAY = TEST_TGE_TIMESTAMP + (DURATION / 2);
const FULL = TEST_TGE_TIMESTAMP + DURATION;

describe('VestingClaims', () => {
  let core: CoreProtocolArbitrumOne;
  let dolo: DOLO;
  let claims: VestingClaims;

  let merkleRoot: string;
  let validProof1: string[];
  let validProof2: string[];
  let invalidProof: string[];

  let user1Amount: BigNumber;
  let user2Amount: BigNumber;
  let totalAmount: BigNumber;

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLO(core, core.governance.address);

    user1Amount = parseEther('6');
    user2Amount = parseEther('10');
    totalAmount = user1Amount.add(user2Amount);
    const rewards = [
      { address: core.hhUser1.address, rewards: user1Amount },
      { address: core.hhUser2.address, rewards: user2Amount },
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
    validProof2 = tree.getHexProof(leaves[1]);
    invalidProof = tree.getHexProof(invalidLeaf);

    claims = await createVestingClaims(core, dolo, TEST_TGE_TIMESTAMP, DURATION);

    await claims.connect(core.governance).ownerSetMerkleRoot(merkleRoot);
    await claims.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(claims.address, true);

    await dolo.connect(core.governance).transfer(claims.address, totalAmount);
    await claims.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await claims.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await claims.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await claims.DOLO()).to.eq(dolo.address);
      expect(await claims.TGE_TIMESTAMP()).to.eq(TEST_TGE_TIMESTAMP);
      expect(await claims.DURATION()).to.eq(DURATION);
      expect(await claims.merkleRoot()).to.eq(merkleRoot);
    });
  });

  describe('#claim', () => {
    it('should revert if before start time', async () => {
      await expectThrow(
        claims.connect(core.hhUser1).claim(validProof1, user1Amount),
        'VestingClaims: No amount to claim'
      );
    });

    it('should revert before year one and then 1/3 at year one', async () => {
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP + ONE_YEAR_SECONDS - 1);
      await expectThrow(
        claims.connect(core.hhUser1).claim(validProof1, user1Amount),
        'VestingClaims: No amount to claim'
      );
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP + ONE_YEAR_SECONDS);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(3)
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount.div(3));
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount.div(3));
    });

    it('should claim full amount if after end time', async () => {
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP + DURATION);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);
      expect(await dolo.balanceOf(claims.address)).to.eq(user2Amount);
    });

    it('should claim half amount if halfway through and then rest at end time', async () => {
      await setNextBlockTimestamp(HALFWAY);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(2)
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await dolo.balanceOf(claims.address)).to.eq(parseEther('13'));

      await setNextBlockTimestamp(FULL);
      const res2 = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(2)
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);
      expect(await dolo.balanceOf(claims.address)).to.eq(user2Amount);
    });

    it('should work normally with multiple users', async () => {
      await ethers.provider.send('evm_setAutomine', [false]);
      await setNextBlockTimestamp(HALFWAY);
      await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await claims.connect(core.hhUser2).claim(validProof2, user2Amount);
      await mine();
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await dolo.balanceOf(core.hhUser2.address)).to.eq(user2Amount.div(2));
      expect(await claims.released(core.hhUser2.address)).to.eq(user2Amount.div(2));
      expect(await dolo.balanceOf(claims.address)).to.eq(user1Amount.add(user2Amount).div(2));

      await setNextBlockTimestamp(FULL);
      await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await claims.connect(core.hhUser2).claim(validProof2, user2Amount);
      await mine();
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);
      expect(await dolo.balanceOf(core.hhUser2.address)).to.eq(user2Amount);
      expect(await claims.released(core.hhUser2.address)).to.eq(user2Amount);
      expect(await dolo.balanceOf(claims.address)).to.eq(ZERO_BI);
      await ethers.provider.send('evm_setAutomine', [true]);
    });

    it('should work normally if user has address remapping', async () => {
      await claims.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser5.address],
        [core.hhUser1.address]
      );
      await setNextBlockTimestamp(HALFWAY);
      const res = await claims.connect(core.hhUser5).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(2)
      });
      expect(await dolo.balanceOf(core.hhUser5.address)).to.eq(user1Amount.div(2));
      expect(await claims.released(core.hhUser5.address)).to.eq(ZERO_BI);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await dolo.balanceOf(claims.address)).to.eq(user2Amount.add(user1Amount.div(2)));
    });

    it('should work if remapped user claims after original address', async () => {
      await claims.connect(core.hhUser5).ownerSetAddressRemapping(
        [core.hhUser5.address],
        [core.hhUser1.address]
      );
      await setNextBlockTimestamp(HALFWAY);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(2)
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await claims.released(core.hhUser5.address)).to.eq(ZERO_BI);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await dolo.balanceOf(claims.address)).to.eq(user2Amount.add(user1Amount.div(2)));

      await setNextBlockTimestamp(FULL);
      await claims.connect(core.hhUser5).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(2)
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await dolo.balanceOf(core.hhUser5.address)).to.eq(user1Amount.div(2));
      expect(await claims.released(core.hhUser5.address)).to.eq(ZERO_BI);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);
      expect(await dolo.balanceOf(claims.address)).to.eq(user2Amount);
    });

    it('should fail if claim is not enabled', async () => {
      await claims.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        claims.connect(core.hhUser1).claim(validProof1, user1Amount),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        claims.connect(core.hhUser3).claim(invalidProof, parseEther('15')),
        'VestingClaims: Invalid merkle proof'
      );
    });
  });
});
