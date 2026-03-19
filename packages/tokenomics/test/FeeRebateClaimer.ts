import { FeeRebateClaimer, FeeRebateClaimer__factory } from '../src/types';
import { IAdminRegistry__factory } from 'packages/admin/src/types';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { disableInterestAccrual, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { BigNumber } from 'ethers';
import { expect } from 'chai';

describe('FeeRebateClaimer', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let feeRebateClaimer: FeeRebateClaimer;

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
