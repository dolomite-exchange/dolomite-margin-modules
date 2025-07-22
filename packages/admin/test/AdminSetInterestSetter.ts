import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminSetInterestSetter, AdminSetInterestSetter__factory } from '../src/types';
import { CoreProtocolEthereum } from 'packages/base/test/utils/core-protocols/core-protocol-ethereum';

describe('AdminSetInterestSetter', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;

  let adminSetInterestSetter: AdminSetInterestSetter;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Ethereum,
      blockNumber: 22_975_000,
    });

    adminSetInterestSetter = await createContractWithAbi<AdminSetInterestSetter>(
      AdminSetInterestSetter__factory.abi,
      AdminSetInterestSetter__factory.bytecode,
      [
        [core.hhUser4.address], // trusted callers
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
      ],
    );

    const adminSetInterestSetterRole = await adminSetInterestSetter.ADMIN_SET_INTEREST_SETTER_ROLE();
    bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
    executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();

    await core.ownerAdapterV2.connect(core.governance).ownerAddRole(adminSetInterestSetterRole);
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      adminSetInterestSetterRole,
      adminSetInterestSetter.address
    );
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      bypassTimelockRole,
      adminSetInterestSetter.address
    );
    await core.ownerAdapterV2.connect(core.governance).grantRole(
      executorRole,
      adminSetInterestSetter.address
    );

    await core.ownerAdapterV2.connect(core.governance).ownerAddRoleToAddressFunctionSelectors(
      adminSetInterestSetterRole,
      core.dolomiteMargin.address,
      ['0x121fb72f']
    );
    await core.ownerAdapterV2.connect(core.governance).ownerAddRoleAddresses(
      adminSetInterestSetterRole,
      [core.interestSetters.modularLinearInterestSetter.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminSetInterestSetter.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await adminSetInterestSetter.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await adminSetInterestSetter.isTrusted(core.hhUser4.address)).to.be.true;
    });
  });

  describe('#ownerSetIsTrusted', () => {
    it('should work normally to add a trusted caller', async () => {
      expect(await adminSetInterestSetter.isTrusted(core.hhUser3.address)).to.be.false;

      const res = await adminSetInterestSetter.connect(core.governance).ownerSetIsTrusted(
        [core.hhUser3.address], [true]
      );

      await expectEvent(adminSetInterestSetter, res, 'IsTrustedSet', {
        interestSetter: core.hhUser3.address,
        isTrusted: true,
      });
      expect(await adminSetInterestSetter.isTrusted(core.hhUser3.address)).to.be.true;
    });

    it('should work normally to remove a trusted caller', async () => {
      expect(await adminSetInterestSetter.isTrusted(core.hhUser4.address)).to.be.true;

      const res = await adminSetInterestSetter.connect(core.governance).ownerSetIsTrusted(
        [core.hhUser4.address], [false]
      );

      await expectEvent(adminSetInterestSetter, res, 'IsTrustedSet', {
        interestSetter: core.hhUser4.address,
        isTrusted: false,
      });
      expect(await adminSetInterestSetter.isTrusted(core.hhUser4.address)).to.be.false;
    });

    it('should fail if sender is not dolomite owner', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.hhUser1).ownerSetIsTrusted(
          [core.hhUser3.address], [true]
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setInterestSetter', () => {
    it('should work normally when called by trusted caller', async () => {
      await adminSetInterestSetter.connect(core.hhUser4).setInterestSetter(
        core.marketIds.usdc,
        core.interestSetters.alwaysZeroInterestSetter.address
      );
      expect(await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.usdc)).to.equal(
        core.interestSetters.alwaysZeroInterestSetter.address
      );
    });

    it('should fail when called by untrusted caller', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.hhUser1).setInterestSetter(
          core.marketIds.usdc,
          ADDRESS_ZERO
        ),
        'AdminSetInterestSetter: Caller is not trusted',
      );
    });
  });

  describe('#setInterestSettingsByToken', () => {
    it('should work normally when called by trusted caller', async () => {
      await adminSetInterestSetter.connect(core.hhUser4).setInterestSettingsByToken(
        core.interestSetters.modularLinearInterestSetter.address,
        core.tokens.usdc.address,
        parseEther('0.05'), // 5% lower optimal
        parseEther('0.10'), // 10% upper optimal
        parseEther('0.80'), // 80% optimal utilization
      );

      const settings = await core.interestSetters.modularLinearInterestSetter.getSettingsByToken(
        core.tokens.usdc.address
      );
      expect(settings.lowerOptimalPercent).to.equal(parseEther('0.05'));
      expect(settings.upperOptimalPercent).to.equal(parseEther('0.10'));
      expect(settings.optimalUtilization).to.equal(parseEther('0.80'));
    });

    it('should fail when called by untrusted caller', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.hhUser1).setInterestSettingsByToken(
          core.interestSetters.modularLinearInterestSetter.address,
          core.tokens.usdc.address,
          parseEther('0.00'),
          parseEther('0.00'),
          parseEther('0.10'),
        ),
        'AdminSetInterestSetter: Caller is not trusted',
      );
    });
  });
});
