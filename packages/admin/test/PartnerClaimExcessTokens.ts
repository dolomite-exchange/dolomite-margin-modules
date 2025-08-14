import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminRegistry, PartnerClaimExcessTokens, PartnerClaimExcessTokens__factory } from '../src/types';

const OTHER_ADDRESS = '0x1234567890123456789012345678901234567890';

describe('PartnerClaimExcessTokens', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;

  let partnerClaimExcessTokens: PartnerClaimExcessTokens;
  let adminRegistry: AdminRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 8_389_300,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    adminRegistry = await createAdminRegistry(core);

    partnerClaimExcessTokens = await createContractWithAbi<PartnerClaimExcessTokens>(
      PartnerClaimExcessTokens__factory.abi,
      PartnerClaimExcessTokens__factory.bytecode,
      [OTHER_ADDRESS, adminRegistry.address, core.dolomiteMargin.address],
    );

    const adminClaimExcessTokensRole = await partnerClaimExcessTokens.ADMIN_CLAIM_EXCESS_TOKENS_ROLE();
    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();

    await core.ownerAdapterV2.connect(core.governance).ownerAddRole(adminClaimExcessTokensRole);
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      adminClaimExcessTokensRole,
      partnerClaimExcessTokens.address
    );
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      bypassTimelockRole,
      partnerClaimExcessTokens.address
    );
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      executorRole,
      partnerClaimExcessTokens.address
    );

    await core.ownerAdapterV2.connect(core.governance).ownerAddRoleToAddressFunctionSelectors(
      adminClaimExcessTokensRole,
      core.dolomiteMargin.address,
      [
        core.dolomiteMargin.interface.getSighash(
          core.dolomiteMargin.interface.getFunction('ownerWithdrawExcessTokens'),
        ),
      ]
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(partnerClaimExcessTokens.address, true);

    await adminRegistry.connect(core.governance).grantPermission(
      '0x7aa25719', // claimExcessTokens selector
      partnerClaimExcessTokens.address,
      core.hhUser4.address
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await partnerClaimExcessTokens.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await partnerClaimExcessTokens.feeReceiver()).to.equal(OTHER_ADDRESS);
    });
  });

  describe('#ownerSetPartnerInfo', () => {
    it('should work normally', async () => {
      const res = await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        { value: parseEther('.6') }
      );
      await expectEvent(partnerClaimExcessTokens, res, 'PartnerInfoSet', {
        marketId: core.marketIds.usdc,
        partner: core.hhUser5.address,
        feeSplitToPartner: { value: parseEther('.6') },
      });

      const partnerInfo = await partnerClaimExcessTokens.getPartnerInfo(core.marketIds.usdc);
      expect(partnerInfo.marketId).to.equal(core.marketIds.usdc);
      expect(partnerInfo.partner).to.equal(core.hhUser5.address);
      expect(partnerInfo.feeSplitToPartner.value).to.equal(parseEther('.6'));
    });

    it('should fail if fee split is greater than 100%', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
          core.marketIds.usdc,
          core.hhUser5.address,
          { value: parseEther('1.5') }
        ),
        'PartnerClaimExcessTokens: Invalid partner or fee split',
      );
    });

    it('should fail if fee split is equal to 0%', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
          core.marketIds.usdc,
          core.hhUser5.address,
          { value: parseEther('0') }
        ),
        'PartnerClaimExcessTokens: Invalid partner or fee split',
      );
    });

    it('should fail if partner address is zero address', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
          core.marketIds.usdc,
          ADDRESS_ZERO,
          { value: parseEther('.5') }
        ),
        'PartnerClaimExcessTokens: Invalid partner or fee split',
      );
    });

    it('should fail if sender is not dolomite owner', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser1).ownerSetPartnerInfo(
          core.marketIds.usdc,
          core.hhUser5.address,
          { value: parseEther('.5') }
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemovePartnerInfo', () => {
    it('should work normally', async () => {
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        { value: parseEther('.5') }
      );

      let partnerInfo = await partnerClaimExcessTokens.getPartnerInfo(core.marketIds.usdc);
      expect(partnerInfo.marketId).to.equal(core.marketIds.usdc);
      expect(partnerInfo.partner).to.equal(core.hhUser5.address);
      expect(partnerInfo.feeSplitToPartner.value).to.equal(parseEther('.5'));

      const res = await partnerClaimExcessTokens.connect(core.governance).ownerRemovePartnerInfo(core.marketIds.usdc);
      await expectEvent(partnerClaimExcessTokens, res, 'PartnerInfoRemoved', {
        marketId: core.marketIds.usdc,
      });

      partnerInfo = await partnerClaimExcessTokens.getPartnerInfo(core.marketIds.usdc);
      expect(partnerInfo.marketId).to.equal(ZERO_BI);
      expect(partnerInfo.partner).to.equal(ADDRESS_ZERO);
      expect(partnerInfo.feeSplitToPartner.value).to.equal(ZERO_BI);
    });

    it('should fail if sender is not dolomite owner', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser1).ownerRemovePartnerInfo(core.marketIds.usdc),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetFeeReceiver', () => {
    it('should work normally', async () => {
      const res = await partnerClaimExcessTokens.connect(core.governance).ownerSetFeeReceiver(core.hhUser5.address);
      await expectEvent(partnerClaimExcessTokens, res, 'FeeReceiverSet', {
        feeReceiver: core.hhUser5.address,
      });
      expect(await partnerClaimExcessTokens.feeReceiver()).to.equal(core.hhUser5.address);
    });

    it('should fail if fee receiver is zero address', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.governance).ownerSetFeeReceiver(ADDRESS_ZERO),
        'PartnerClaimExcessTokens: Invalid fee receiver',
      );
    });

    it('should fail if not called by dolomite owner', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser1).ownerSetFeeReceiver(core.hhUser5.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#claimExcessTokens', () => {
    it('should work normally when called by partner and not depositing into dolomite margin', async () => {
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        { value: parseEther('.6') }
      );

      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      const partnerBalance = excessTokens.value.mul(6).div(10);
      await partnerClaimExcessTokens.connect(core.hhUser5).claimExcessTokens(core.tokens.usdc.address, false);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(partnerBalance);
      expect(await core.tokens.usdc.balanceOf(OTHER_ADDRESS)).to.equal(
        excessTokens.value.sub(partnerBalance),
      );
    });

    it('should work normally when called by user with permission and not depositing into dolomite margin', async () => {
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        { value: parseEther('.6') }
      );

      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      const partnerBalance = excessTokens.value.mul(6).div(10);

      await partnerClaimExcessTokens.connect(core.hhUser4).claimExcessTokens(core.tokens.usdc.address, false);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(partnerBalance);
      expect(await core.tokens.usdc.balanceOf(OTHER_ADDRESS)).to.equal(
        excessTokens.value.sub(partnerBalance),
      );
    });

    it('should work normally when depositing into dolomite margin', async () => {
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        { value: parseEther('.6') }
      );

      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      const partnerBalance = excessTokens.value.mul(6).div(10);

      await partnerClaimExcessTokens.connect(core.hhUser4).claimExcessTokens(core.tokens.usdc.address, true);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(partnerBalance);
      await expectProtocolBalance(
        core,
        OTHER_ADDRESS,
        0,
        core.marketIds.usdc,
        excessTokens.value.sub(partnerBalance),
      );
    });

    it('should work normally when no fees to transfer', async () => {
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        { value: parseEther('.6') }
      );

      await core.dolomiteMargin.connect(core.governance).ownerWithdrawExcessTokens(
        core.marketIds.usdc,
        core.hhUser4.address
      );
      await partnerClaimExcessTokens.connect(core.hhUser4).claimExcessTokens(core.tokens.usdc.address, false);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(0);
      expect(await core.tokens.usdc.balanceOf(OTHER_ADDRESS)).to.equal(0);
    });

    it('should fail if partner is not set', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser4).claimExcessTokens(core.tokens.usdc.address, false),
        'PartnerClaimExcessTokens: Partner not set',
      );
    });

    it('should fail if sender is not partner or user with permission', async () => {
      await partnerClaimExcessTokens.connect(core.governance).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        { value: parseEther('.6') }
      );

      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser1).claimExcessTokens(core.tokens.usdc.address, false),
        'PartnerClaimExcessTokens: Invalid sender',
      );
    });
  });
});
