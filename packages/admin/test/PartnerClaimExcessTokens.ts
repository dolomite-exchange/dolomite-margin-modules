import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createAndUpgradeDolomiteRegistry } from 'packages/base/test/utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { PartnerClaimExcessTokens, PartnerClaimExcessTokens__factory } from '../src/types';
import { ethers } from 'hardhat';
import { parseEther } from 'ethers/lib/utils';

const ADMIN_CLAIM_EXCESS_TOKENS_ROLE = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('AdminClaimExcessTokens')
);

describe('PartnerClaimExcessTokens', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  let partnerClaimExcessTokens: PartnerClaimExcessTokens;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 3_389_300,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    await createAndUpgradeDolomiteRegistry(core);

    partnerClaimExcessTokens = await createContractWithAbi<PartnerClaimExcessTokens>(
      PartnerClaimExcessTokens__factory.abi,
      PartnerClaimExcessTokens__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();

    dolomiteOwnerImpersonator = await impersonate(core.ownerAdapterV2.address, true);
    await core.ownerAdapterV2.connect(dolomiteOwnerImpersonator).ownerAddRole(ADMIN_CLAIM_EXCESS_TOKENS_ROLE);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(ADMIN_CLAIM_EXCESS_TOKENS_ROLE, partnerClaimExcessTokens.address);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(bypassTimelockRole, partnerClaimExcessTokens.address);
    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .grantRole(executorRole, partnerClaimExcessTokens.address);

    await core.ownerAdapterV2
      .connect(dolomiteOwnerImpersonator)
      .ownerAddRoleToAddressFunctionSelectors(ADMIN_CLAIM_EXCESS_TOKENS_ROLE, core.dolomiteMargin.address, [
        core.dolomiteMargin.interface.getSighash(
          core.dolomiteMargin.interface.getFunction('ownerWithdrawExcessTokens'),
        ),
      ]);
    await core.dolomiteMargin
      .connect(dolomiteOwnerImpersonator)
      .ownerSetGlobalOperator(partnerClaimExcessTokens.address, true);
    await core.dolomiteRegistry.connect(dolomiteOwnerImpersonator).ownerSetTreasury(core.gnosisSafe.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await partnerClaimExcessTokens.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await partnerClaimExcessTokens.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#ownerSetPartnerInfo', () => {
    it('should work normally', async () => {
      const res = await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        parseEther('.5'),
      );
      await expectEvent(partnerClaimExcessTokens, res, 'PartnerInfoSet', {
        marketId: core.marketIds.usdc,
        partner: core.hhUser5.address,
        feeSplit: parseEther('.5'),
      });

      const partnerInfo = await partnerClaimExcessTokens.getPartnerInfo(core.marketIds.usdc);
      expect(partnerInfo.marketId).to.equal(core.marketIds.usdc);
      expect(partnerInfo.partner).to.equal(core.hhUser5.address);
      expect(partnerInfo.feeSplit).to.equal(parseEther('.5'));
    });

    it('should fail if fee split is greater than 100%', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
          core.marketIds.usdc,
          core.hhUser5.address,
          parseEther('1.5'),
        ),
        'PartnerClaimExcessTokens: Invalid partner or fee split',
      );
    });

    it('should fail if partner address is zero address', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
          core.marketIds.usdc,
          ADDRESS_ZERO,
          parseEther('.5'),
        ),
        'PartnerClaimExcessTokens: Invalid partner or fee split',
      );
    });

    it('should fail if sender is not dolomite owner', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser1).ownerSetPartnerInfo(
          core.marketIds.usdc,
          core.hhUser5.address,
          parseEther('.5'),
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerRemovePartnerInfo', () => {
    it('should work normally', async () => {
      await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        parseEther('.5'),
      );
      let partnerInfo = await partnerClaimExcessTokens.getPartnerInfo(core.marketIds.usdc);
      expect(partnerInfo.marketId).to.equal(core.marketIds.usdc);
      expect(partnerInfo.partner).to.equal(core.hhUser5.address);
      expect(partnerInfo.feeSplit).to.equal(parseEther('.5'));

      const res = await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerRemovePartnerInfo(
        core.marketIds.usdc
      );
      await expectEvent(partnerClaimExcessTokens, res, 'PartnerInfoRemoved', {
        marketId: core.marketIds.usdc,
      });
      partnerInfo = await partnerClaimExcessTokens.getPartnerInfo(core.marketIds.usdc);
      expect(partnerInfo.marketId).to.equal(ZERO_BI);
      expect(partnerInfo.partner).to.equal(ADDRESS_ZERO);
      expect(partnerInfo.feeSplit).to.equal(ZERO_BI);
    });

    it('should fail if sender is not dolomite owner', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser1).ownerRemovePartnerInfo(core.marketIds.usdc),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#claimExcessTokens', () => {
    it('should work normally when called by partner and not depositing into dolomite margin', async () => {
      await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        parseEther('.5'),
      );

      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      const partnerBalance = excessTokens.value.div(2);
      await partnerClaimExcessTokens.connect(core.hhUser5).claimExcessTokens(core.tokens.usdc.address, false);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(partnerBalance);
      expect(await core.tokens.usdc.balanceOf(core.gnosisSafe.address)).to.equal(
        excessTokens.value.sub(partnerBalance)
      );
    });

    it('should work normally when called by treasury and not depositing into dolomite margin', async () => {
      await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        parseEther('.5'),
      );

      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      const partnerBalance = excessTokens.value.div(2);
      await partnerClaimExcessTokens.connect(core.gnosisSafe).claimExcessTokens(core.tokens.usdc.address, false);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(partnerBalance);
      expect(await core.tokens.usdc.balanceOf(core.gnosisSafe.address)).to.equal(
        excessTokens.value.sub(partnerBalance)
      );
    });

    it('should work normally when depositing into dolomite margin', async () => {
      await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        parseEther('.5'),
      );

      const excessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      const partnerBalance = excessTokens.value.div(2);
      await partnerClaimExcessTokens.connect(core.gnosisSafe).claimExcessTokens(core.tokens.usdc.address, true);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(partnerBalance);
      await expectProtocolBalance(
        core,
        core.gnosisSafe,
        0,
        core.marketIds.usdc,
        excessTokens.value.sub(partnerBalance),
      );
    });

    it('should work normally when no fees to transfer', async () => {
      await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        parseEther('.5'),
      );

      await core.dolomiteMargin.connect(dolomiteOwnerImpersonator).ownerWithdrawExcessTokens(
        core.marketIds.usdc,
        core.hhUser4.address,
      );
      await partnerClaimExcessTokens.connect(core.gnosisSafe).claimExcessTokens(core.tokens.usdc.address, false);
      expect(await core.tokens.usdc.balanceOf(core.hhUser5.address)).to.equal(0);
      expect(await core.tokens.usdc.balanceOf(core.gnosisSafe.address)).to.equal(0);
    });

    it('should fail if partner is not set', async () => {
      await expectThrow(
        partnerClaimExcessTokens.connect(core.gnosisSafe).claimExcessTokens(core.tokens.usdc.address, false),
        'PartnerClaimExcessTokens: Partner not set',
      );
    });

    it('should fail if sender is not partner or treasury', async () => {
      await partnerClaimExcessTokens.connect(dolomiteOwnerImpersonator).ownerSetPartnerInfo(
        core.marketIds.usdc,
        core.hhUser5.address,
        parseEther('.5'),
      );

      await expectThrow(
        partnerClaimExcessTokens.connect(core.hhUser1).claimExcessTokens(core.tokens.usdc.address, false),
        'PartnerClaimExcessTokens: Invalid sender',
      );
    });
  });
});
