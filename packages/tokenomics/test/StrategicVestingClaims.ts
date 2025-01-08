import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { DOLO, StrategicVestingClaims, StrategicVestingClaims__factory } from '../src/types';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createDOLO } from './tokenomics-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent } from 'packages/base/test/utils/assertions';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { BigNumber } from 'ethers';

const TEST_TGE_TIMESTAMP = 1730000000;
const ONE_MONTH_SECONDS = 30 * ONE_DAY_SECONDS;
const DURATION = ONE_MONTH_SECONDS * 13;
const HALFWAY = (TEST_TGE_TIMESTAMP - ONE_MONTH_SECONDS) + (DURATION / 2);
const FULL = (TEST_TGE_TIMESTAMP - ONE_MONTH_SECONDS) + DURATION;

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
    dolo = await createDOLO(core);

    user1Amount = parseEther('13');
    user2Amount = parseEther('13');
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

    claims = await createContractWithAbi<StrategicVestingClaims>(
      StrategicVestingClaims__factory.abi,
      StrategicVestingClaims__factory.bytecode,
      [dolo.address, TEST_TGE_TIMESTAMP, DURATION, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await claims.connect(core.governance).ownerSetMerkleRoot(merkleRoot);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(claims.address, true);

    await dolo.connect(core.governance).mint(parseEther('100'));
    await dolo.connect(core.governance).transfer(claims.address, parseEther('100'));

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#claim', () => {
    it('should claim zero if before TGE and 1/13 at TGE', async () => {
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP - 1);
      const res = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: ZERO_BI
      });
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP);
      const res2 = await claims.connect(core.hhUser1).claim(validProof1, user1Amount);
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: ONE_ETH_BI
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(ONE_ETH_BI);
      expect(await claims.released(core.hhUser1.address)).to.eq(ONE_ETH_BI);
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
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(2)
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount.div(2));
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount.div(2));

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
    });
  });
});
