import { Network, ONE_DAY_SECONDS, ONE_ETH_BI, ONE_WEEK_SECONDS } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { VeFeeCalculator } from '../src/types';
import { createVeFeeCalculator } from './liquidity-mining-ecosystem-utils';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expect } from 'chai';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { parseEther } from 'ethers/lib/utils';

const TWO_YEARS_SECONDS = ONE_DAY_SECONDS * 365 * 2;
const ONE_YEAR_SECONDS = ONE_DAY_SECONDS * 365;
const TIMESTAMP = 2_000_000_000; // using timestamp for ease of testing
const tokenAmount = ONE_ETH_BI;

describe('VeFeeCalculator', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let feeCalculator: VeFeeCalculator;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    feeCalculator = await createVeFeeCalculator(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerSetBurnFee', () => {
    it('should work normally', async () => {
      expect(await feeCalculator.burnFee()).to.eq(parseEther('.05'));
      const res = await feeCalculator.connect(core.governance).ownerSetBurnFee(parseEther('.1'));
      await expectEvent(feeCalculator, res, 'BurnFeeSet',
        { burnFee: parseEther('.1') }
      );
      expect(await feeCalculator.burnFee()).to.eq(parseEther('.1'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        feeCalculator.connect(core.hhUser1).ownerSetBurnFee(parseEther('.1')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetDecayTimestamp', () => {
    it('should work normally', async () => {
      expect(await feeCalculator.decayTimestamp()).to.eq(0);
      const res = await feeCalculator.connect(core.governance).ownerSetDecayTimestamp(TIMESTAMP);
      await expectEvent(feeCalculator, res, 'DecayTimestampSet',
        { decayTimestamp: TIMESTAMP }
      );
      expect(await feeCalculator.decayTimestamp()).to.eq(TIMESTAMP);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        feeCalculator.connect(core.hhUser1).ownerSetDecayTimestamp(TIMESTAMP),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getEarlyWithdrawalFees', () => {
    beforeEach(async () => {
      await feeCalculator.connect(core.governance).ownerSetDecayTimestamp(1);
    });

    it('should work normally if lock is expired', async () => {
      await increaseTo(TIMESTAMP);
      const fees = await feeCalculator.getEarlyWithdrawalFees(ONE_ETH_BI, TIMESTAMP - 1);
      expect(fees[0]).to.eq(0);
      expect(fees[1]).to.eq(0);
    });

    it('burn fee should work normally through TGE', async () => {
      const lockEndTime = TIMESTAMP + ONE_WEEK_SECONDS * 16;
      await feeCalculator.connect(core.governance).ownerSetDecayTimestamp(TIMESTAMP);
      await increaseTo(TIMESTAMP);

      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.4'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.35625'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS * 2);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.3125'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS * 4);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.2250'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS * 6);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.1375'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS * 8);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.05'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS * 10);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.05'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS * 16 - 1);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(parseEther('.05'));

      await increaseTo(TIMESTAMP + ONE_WEEK_SECONDS * 16);
      expect((await feeCalculator.getEarlyWithdrawalFees(tokenAmount, lockEndTime))[0]).to.eq(0);
    });

    it('recoup fee should work normally for 2 year lock', async () => {
      await increaseTo(TIMESTAMP);
      const fees = await feeCalculator.getEarlyWithdrawalFees(tokenAmount, TIMESTAMP + TWO_YEARS_SECONDS);
      expect(fees[1]).to.eq(parseEther('.5'));
    });

    it('recoup fee should work normally with half the time left (365 + 3.5 days)', async () => {
      await increaseTo(TIMESTAMP);
      const fees = await feeCalculator.getEarlyWithdrawalFees(tokenAmount, TIMESTAMP + ONE_DAY_SECONDS * 368.5);
      expect(fees[1]).to.eq(parseEther('.275'));
    });

    it('recoup fee should work normally with one quarter of the time left (half of a year + 1.75 days)', async () => {
      await increaseTo(TIMESTAMP);
      const fees = await feeCalculator.getEarlyWithdrawalFees(
        tokenAmount,
        TIMESTAMP + ONE_YEAR_SECONDS + 5.25 * ONE_DAY_SECONDS
      );
      expect(fees[1]).to.eq(parseEther('.1625'));
    });

    it('recoup fee should be 5% 1 week before lock ends through lock end', async () => {
      await increaseTo(TIMESTAMP);
      let fees = await feeCalculator.getEarlyWithdrawalFees(tokenAmount, TIMESTAMP + ONE_WEEK_SECONDS);
      expect(fees[1]).to.eq(parseEther('.05'));

      fees = await feeCalculator.getEarlyWithdrawalFees(tokenAmount, TIMESTAMP + 1);
      expect(fees[1]).to.eq(parseEther('.05'));
    });
  });
});