import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { Network, ONE_DAY_SECONDS, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { DOLO, StrategicVestingClaims } from '../src/types';
import { createDOLO, createStrategicVestingClaims } from './tokenomics-ecosystem-utils';

const TEST_TGE_TIMESTAMP = 1730000000;
const DURATION = ONE_DAY_SECONDS * 365;
const HALFWAY = TEST_TGE_TIMESTAMP + DURATION / 2;
const FULL = TEST_TGE_TIMESTAMP + DURATION;

describe('StrategicVestingClaims', () => {
  let core: CoreProtocolArbitrumOne;
  let dolo: DOLO;
  let claims: StrategicVestingClaims;

  let user1Amount: BigNumber;
  let user2Amount: BigNumber;
  let totalAmount: BigNumber;

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLO(core, core.hhUser5.address);

    user1Amount = parseEther('6');
    user2Amount = parseEther('10');
    totalAmount = user1Amount.add(user2Amount);

    claims = await createStrategicVestingClaims(core, dolo, TEST_TGE_TIMESTAMP, DURATION);

    await claims.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await claims
      .connect(core.governance)
      .ownerSetAllocatedAmounts([core.hhUser1.address, core.hhUser2.address], [user1Amount, user2Amount]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(claims.address, true);

    await dolo.connect(core.hhUser5).transfer(claims.address, totalAmount);
    await claims.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#claim', () => {
    it('should revert if before TGE and 10% at TGE', async () => {
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP - 1);
      await expectThrow(claims.connect(core.hhUser1).claim(), 'VestingClaims: No amount to claim');
      await setNextBlockTimestamp(TEST_TGE_TIMESTAMP);
      const res = await claims.connect(core.hhUser1).claim();
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount.div(10),
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(ONE_ETH_BI);
      expect(await claims.released(core.hhUser1.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if claim is not enabled', async () => {
      await claims.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        claims.connect(core.hhUser1).claim(),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should claim full amount if after end time', async () => {
      await setNextBlockTimestamp(FULL);
      const res = await claims.connect(core.hhUser1).claim();
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: user1Amount,
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);
    });

    it('should claim half amount if halfway through and then rest at end time', async () => {
      await setNextBlockTimestamp(HALFWAY);
      const res = await claims.connect(core.hhUser1).claim();
      const amount = parseEther('3.3');
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: amount,
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(amount);

      await setNextBlockTimestamp(FULL);
      const res2 = await claims.connect(core.hhUser1).claim();
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: parseEther('2.7'),
      });
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(user1Amount);
      expect(await claims.released(core.hhUser1.address)).to.eq(user1Amount);

      const res3 = await claims.connect(core.hhUser2).claim();
      await expectEvent(core.eventEmitterRegistry, res3, 'RewardClaimed', {
        distributor: claims.address,
        user: core.hhUser2.address,
        epoch: ZERO_BI,
        amount: parseEther('10'),
      });
      expect(await dolo.balanceOf(core.hhUser2.address)).to.eq(user2Amount);
      expect(await claims.released(core.hhUser2.address)).to.eq(user2Amount);
    });
  });
});
