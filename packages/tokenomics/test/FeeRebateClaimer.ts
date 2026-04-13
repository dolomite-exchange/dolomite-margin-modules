import {
  FeeRebateClaimer,
  FeeRebateClaimer__factory,
  TestFeeRebateRollingClaims,
  TestFeeRebateRollingClaims__factory,
} from '../src/types';
import { IAdminRegistry__factory } from 'packages/admin/src/types';
import { RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance } from 'packages/base/test/utils/setup';
import { getRegistryProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { BigNumber } from 'ethers';
import { expect } from 'chai';

describe('FeeRebateClaimer', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let feeRebateClaimer: FeeRebateClaimer;
  let rollingClaims: TestFeeRebateRollingClaims;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 18_390_000,
    });

    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.weth);

    feeRebateClaimer = await createContractWithAbi<FeeRebateClaimer>(
      FeeRebateClaimer__factory.abi,
      FeeRebateClaimer__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    const adminRegistry = IAdminRegistry__factory.connect(
      await core.adminClaimExcessTokens.ADMIN_REGISTRY(),
      core.governance,
    );
    await adminRegistry.grantPermission(
      core.adminClaimExcessTokens.interface.getSighash('claimExcessTokens'),
      core.adminClaimExcessTokens.address,
      feeRebateClaimer.address,
    );

    await feeRebateClaimer.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await feeRebateClaimer.connect(core.governance).ownerSetAdminFeeClaimer(core.adminClaimExcessTokens.address);
    await feeRebateClaimer.connect(core.governance).ownerSetRevenueSweeper(core.hhUser1.address);

    const implementation = await createContractWithAbi<TestFeeRebateRollingClaims>(
      TestFeeRebateRollingClaims__factory.abi,
      TestFeeRebateRollingClaims__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    rollingClaims = TestFeeRebateRollingClaims__factory.connect(
      (await createContractWithAbi(
        RegistryProxy__factory.abi,
        RegistryProxy__factory.bytecode,
        getRegistryProxyConstructorParams(
          implementation.address,
          (await implementation.populateTransaction.initialize()).data!,
          core.dolomiteMargin,
        ),
      )).address,
      core.hhUser1,
    );
    await feeRebateClaimer.connect(core.governance).ownerSetFeeRebateRollingClaims(rollingClaims.address);
    await rollingClaims.connect(core.governance).ownerSetFeeRebateClaimer(feeRebateClaimer.address);
    await rollingClaims.connect(core.governance).ownerSetHandler(feeRebateClaimer.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(feeRebateClaimer.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await feeRebateClaimer.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await feeRebateClaimer.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await feeRebateClaimer.adminFeeClaimer()).to.eq(core.adminClaimExcessTokens.address);
      expect(await feeRebateClaimer.epoch()).to.eq(ZERO_BI);
    });
  });

  describe('#ownerSetAdminFeeClaimer', () => {
    it('should work normally', async () => {
      const res = await feeRebateClaimer.connect(core.governance).ownerSetAdminFeeClaimer(core.hhUser1.address);
      await expectEvent(feeRebateClaimer, res, 'AdminFeeClaimerSet', {
        adminFeeClaimer: core.hhUser1.address,
      });
      expect(await feeRebateClaimer.adminFeeClaimer()).to.eq(core.hhUser1.address);
    });

    it('should fail if called with zero address', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.governance).ownerSetAdminFeeClaimer(ADDRESS_ZERO),
        'FeeRebateClaimer: Invalid fee claimer address',
      );
    });

    it('should fail if called by non-owner', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser1).ownerSetAdminFeeClaimer(core.hhUser2.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetFeeRebateRollingClaims', () => {
    it('should work normally', async () => {
      const res = await feeRebateClaimer.connect(core.governance).ownerSetFeeRebateRollingClaims(core.hhUser1.address);
      await expectEvent(feeRebateClaimer, res, 'FeeRebateRollingClaimsSet', {
        feeRebateRollingClaims: core.hhUser1.address,
      });
      expect(await feeRebateClaimer.feeRebateRollingClaims()).to.eq(core.hhUser1.address);
    });

    it('should fail if called with zero address', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.governance).ownerSetFeeRebateRollingClaims(ADDRESS_ZERO),
        'FeeRebateClaimer: Invalid fee rebate claims',
      );
    });

    it('should fail if called by non-owner', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser1).ownerSetFeeRebateRollingClaims(core.hhUser2.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetRevenueSweeper', () => {
    it('should work normally', async () => {
      const res = await feeRebateClaimer.connect(core.governance).ownerSetRevenueSweeper(core.hhUser2.address);
      await expectEvent(feeRebateClaimer, res, 'RevenueSweeperSet', {
        revenueSweeper: core.hhUser2.address,
      });
      expect(await feeRebateClaimer.revenueSweeper()).to.eq(core.hhUser2.address);
    });

    it('should fail if called with zero address', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.governance).ownerSetRevenueSweeper(ADDRESS_ZERO),
        'FeeRebateClaimer: Invalid revenue sweeper',
      );
    });

    it('should fail if called by non-owner', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser1).ownerSetRevenueSweeper(core.hhUser2.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#handlerSweepRevenue', () => {
    it('should work normally when there is revenue to sweep', async () => {
      const excessUsdc = (await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc)).value;

      // 1. Claim tokens to FeeRebateClaimer
      await feeRebateClaimer.connect(core.hhUser5).handlerClaimRewardsByEpochAndMarketId(
        1,
        [core.marketIds.usdc],
        true,
      );

      // balance of FeeRebateClaimer is now excessUsdc
      // currentEpoch is 1.
      // rollingClaims.currentEpoch() is 0.

      // 2. Update rollingClaims epoch to 1
      await rollingClaims.connect(core.governance).ownerSetHandler(core.hhUser1.address);
      await rollingClaims.connect(core.hhUser1).handlerSetMerkleRoots(
        [core.marketIds.usdc],
        [BYTES_ZERO.replace('00', '01')],
        [excessUsdc],
        1,
      );

      // Now epoch() == rollingClaims.currentEpoch() == 1
      // marketIdToTotalAmount(usdc) = excessUsdc
      // marketIdToClaimAmount(usdc) = 0
      // sweepable = balance - (total - claimed) = excessUsdc - (excessUsdc - 0) = 0

      await feeRebateClaimer.connect(core.hhUser5).handlerSweepRevenue([core.marketIds.usdc]);
      // Should not emit transfer because sweepable is 0
      await expectProtocolBalance(core, feeRebateClaimer, ZERO_BI, core.marketIds.usdc, excessUsdc);

      // Now let's make some users claim, so sweepable remains 0?
      // No, if totalAmount is excessUsdc, and balance is excessUsdc, sweepable is 0.
      // To have sweepable > 0, we need balance > (totalAmount - claimedAmount).

      // Let's send some extra tokens to FeeRebateClaimer directly.
      const extraAmount = BigNumber.from('1000000');
      const feeRebateClaimerImp = await impersonate(feeRebateClaimer.address, true);
      await setupUSDCBalance(core, feeRebateClaimerImp, extraAmount, core.depositWithdrawalRouter);
      await core.depositWithdrawalRouter
        .connect(feeRebateClaimerImp)
        .depositWei(0, 0, core.marketIds.usdc, extraAmount, 0);

      // balance = excessUsdc + extraAmount
      // total = excessUsdc, claimed = 0.
      // sweepable = (excessUsdc + extraAmount) - (excessUsdc - 0) = extraAmount.

      const sweeper = await feeRebateClaimer.revenueSweeper();
      await feeRebateClaimer.connect(core.hhUser5).handlerSweepRevenue([core.marketIds.usdc]);
      // It uses AccountActionLib.transfer which doesn't emit a standard event on the claimer,
      // but we can check the balance of the sweeper.
      await expectProtocolBalance(core, sweeper, 0, core.marketIds.usdc, extraAmount);
      expect((await core.dolomiteMargin.getAccountWei(
        { owner: feeRebateClaimer.address, number: 0 },
        core.marketIds.usdc,
      )).value)
        .to.eq(excessUsdc);
    });

    it('should fail if marketIds is empty', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser5).handlerSweepRevenue([]),
        'FeeRebateClaimer: Invalid marketIds',
      );
    });

    it('should fail if epoch mismatch', async () => {
      // feeRebateClaimer.epoch() is 0, rollingClaims.currentEpoch() is 0.
      // After one claim:
      await feeRebateClaimer.connect(core.hhUser5).handlerClaimRewardsByEpochAndMarketId(
        1,
        [core.marketIds.usdc],
        true,
      );
      // feeRebateClaimer.epoch() is 1, rollingClaims.currentEpoch() is 0.

      await expectThrow(
        feeRebateClaimer.connect(core.hhUser5).handlerSweepRevenue([core.marketIds.usdc]),
        'FeeRebateClaimer: Epoch mismatch',
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser1).handlerSweepRevenue([core.marketIds.usdc]),
        'BaseClaim: Only handler can call',
      );
    });
  });

  describe('#handlerClaimRewardsByEpochAndMarketId', () => {
    it('should work normally for one marketId and not increment epoch', async () => {
      const excessUsdc = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);

      const res = await feeRebateClaimer.connect(core.hhUser5).handlerClaimRewardsByEpochAndMarketId(
        1,
        [core.marketIds.usdc],
        false,
      );
      await expectEvent(feeRebateClaimer, res, 'MarketIdToFeesClaimed', {
        epoch: BigNumber.from(1),
        marketId: core.marketIds.usdc,
        claimedAmountWei: excessUsdc.value,
      });

      expect(await feeRebateClaimer.epoch()).to.eq(ZERO_BI);
      expect(await feeRebateClaimer.getClaimAmountByEpochAndMarketId(1, core.marketIds.usdc)).to.eq(excessUsdc.value);
      await expectProtocolBalance(core, feeRebateClaimer, 0, core.marketIds.usdc, excessUsdc.value);
    });

    it('should work normally for multiple marketIds and increment epoch', async () => {
      const excessUsdc = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      const excessWeth = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.weth);

      const res = await feeRebateClaimer.connect(core.hhUser5).handlerClaimRewardsByEpochAndMarketId(
        1,
        [core.marketIds.usdc, core.marketIds.weth],
        true,
      );

      await expectEvent(feeRebateClaimer, res, 'MarketIdToFeesClaimed', {
        epoch: BigNumber.from(1),
        marketId: core.marketIds.usdc,
        claimedAmountWei: excessUsdc.value,
      });
      await expectEvent(feeRebateClaimer, res, 'MarketIdToFeesClaimed', {
        epoch: BigNumber.from(1),
        marketId: core.marketIds.weth,
        claimedAmountWei: excessWeth.value,
      });
      await expectEvent(feeRebateClaimer, res, 'EpochSet', {
        epoch: BigNumber.from(1),
      });

      expect(await feeRebateClaimer.epoch()).to.eq(BigNumber.from(1));
      expect(await feeRebateClaimer.getClaimAmountByEpochAndMarketId(1, core.marketIds.usdc)).to.eq(excessUsdc.value);
      expect(await feeRebateClaimer.getClaimAmountByEpochAndMarketId(1, core.marketIds.weth)).to.eq(excessWeth.value);
      await expectProtocolBalance(core, feeRebateClaimer, 0, core.marketIds.usdc, excessUsdc.value);
      await expectProtocolBalance(core, feeRebateClaimer, 0, core.marketIds.weth, excessWeth.value);
    });

    it('should fail if called by non-handler', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser1).handlerClaimRewardsByEpochAndMarketId(1, [core.marketIds.usdc], false),
        'BaseClaim: Only handler can call',
      );
    });

    it('should fail if epoch is zero', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser5).handlerClaimRewardsByEpochAndMarketId(0, [core.marketIds.usdc], false),
        'FeeRebateClaimer: Epoch cannot be 0',
      );
    });

    it('should fail if epoch is invalid', async () => {
      await expectThrow(
        feeRebateClaimer.connect(core.hhUser5).handlerClaimRewardsByEpochAndMarketId(2, [core.marketIds.usdc], false),
        'FeeRebateClaimer: Invalid epoch <1, 2>',
      );
    });

    it('should fail if marketId has already been claimed for epoch', async () => {
      await feeRebateClaimer.connect(core.hhUser5)
        .handlerClaimRewardsByEpochAndMarketId(1, [core.marketIds.usdc], false);

      await expectThrow(
        feeRebateClaimer.connect(core.hhUser5).handlerClaimRewardsByEpochAndMarketId(1, [core.marketIds.usdc], false),
        'FeeRebateClaimer: Already claimed <1, 2>',
      );
    });
  });
});
