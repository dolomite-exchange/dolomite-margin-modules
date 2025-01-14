import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  DOLO,
  StrategicVestingClaims,
} from '../src/types';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createDOLO, createStrategicVestingClaims } from './tokenomics-ecosystem-utils';
import { Network, ONE_DAY_SECONDS, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { BigNumber } from 'ethers';

const TEST_TGE_TIMESTAMP = 1730000000;
const DURATION = ONE_DAY_SECONDS * 365;
const HALFWAY = TEST_TGE_TIMESTAMP + (DURATION / 2);
const FULL = TEST_TGE_TIMESTAMP + DURATION;

describe('StrategicVestingClaims', () => {
  let core: CoreProtocolArbitrumOne;
  let dolo: DOLO;
  let claims: StrategicVestingClaims;

  let merkleRoot: string;
  let validProof1: string[];
  let validProof2: string[];
  let invalidProof: string[];

  let user1Amount: BigNumber;
  let user2Amount: BigNumber;
  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLO(core, core.hhUser5.address);

    user1Amount = parseEther('10');
    user2Amount = parseEther('10');
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

    claims = await createStrategicVestingClaims(core, dolo, TEST_TGE_TIMESTAMP, DURATION);

    await claims.connect(core.governance).ownerSetMerkleRoot(merkleRoot);
    await claims.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(claims.address, true);

    await dolo.connect(core.governance).mint(parseEther('100'));
    await dolo.connect(core.governance).transfer(claims.address, parseEther('100'));
    await claims.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#claim', () => {
    it('should revert if before TGE and 10% at TGE', async () => {
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP - 1);
      await expectThrow(
        claims.connect(core.hhUser1).claim(validProof1, user1Amount),
        'VestingClaims: No amount to claim'
      );
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: ONE_ETH_BI
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(ONE_ETH_BI);
      expect(await claims.released(core.hhUser1.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if claim is not enabled', async () => {
      await claims.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        claims.connect(core.hhUser1).claim(validProof1, user1Amount),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should claim full amount if after end time', async () => {
      await setNextBlockTimestamp(FULL);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);
    });

    it('should claim half amount if halfway through and then rest at end time', async () => {
      await setNextBlockTimestamp(HALFWAY);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      const amount = parseEther('5.5');
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: amount
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(amount);

      await setNextBlockTimestamp(FULL);
      const res2 = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: parseEther('4.5')
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);
    });
  });
});
