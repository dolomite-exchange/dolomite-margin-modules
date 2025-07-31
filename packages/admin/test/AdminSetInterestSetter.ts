import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { keccak256, parseEther, toUtf8Bytes } from 'ethers/lib/utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminRegistry, AdminSetInterestSetter, AdminSetInterestSetter__factory } from '../src/types';
import { CoreProtocolEthereum } from 'packages/base/test/utils/core-protocols/core-protocol-ethereum';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';

const OTHER_ADDRESS = '0x1234567890123456789012345678901234567890';

const SET_INTEREST_SETTER_BY_MARKET_ID_SELECTOR = keccak256(toUtf8Bytes('setInterestSetterByMarketId(uint256,address)')).slice(0, 10); // tslint:disable-line
const SET_MODULAR_INTEREST_SETTER_BY_MARKET_ID_SELECTOR = keccak256(toUtf8Bytes('setModularInterestSetterByMarketId(uint256)')).slice(0, 10); // tslint:disable-line
const SET_INTEREST_SETTINGS_BY_TOKEN_SELECTOR = keccak256(toUtf8Bytes('setInterestSettingsByToken(address,uint256,uint256,uint256)')).slice(0, 10); // tslint-disable-line

describe('AdminSetInterestSetter', () => {
  let snapshotId: string;

  let core: CoreProtocolEthereum;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;

  let adminRegistry: AdminRegistry;
  let adminSetInterestSetter: AdminSetInterestSetter;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Ethereum,
      blockNumber: 22_975_000,
    });

    adminRegistry = await createAdminRegistry(core);

    adminSetInterestSetter = await createContractWithAbi<AdminSetInterestSetter>(
      AdminSetInterestSetter__factory.abi,
      AdminSetInterestSetter__factory.bytecode,
      [
        core.interestSetters.modularInterestSetter.address,
        adminRegistry.address,
        core.dolomiteMargin.address,
      ],
    );

    const adminSetInterestSetterRole = keccak256(toUtf8Bytes('ADMIN_SET_INTEREST_SETTER_ROLE'));
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
      [core.interestSetters.modularInterestSetter.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminSetInterestSetter.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await adminSetInterestSetter.ADMIN_REGISTRY()).to.equal(adminRegistry.address);
    });
  });

  describe('#ownerSetModularInterestSetter', () => {
    it('should work normally', async () => {
      const res = await adminSetInterestSetter.connect(core.governance).ownerSetModularInterestSetter(
        OTHER_ADDRESS
      );

      await expectEvent(adminSetInterestSetter, res, 'ModularInterestSetterSet', {
        interestSetter: OTHER_ADDRESS,
      });
      expect(await adminSetInterestSetter.modularInterestSetter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if address is zero', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.governance).ownerSetModularInterestSetter(
          ADDRESS_ZERO
        ),
        'AdminSetInterestSetter: Invalid modular interest setter'
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.hhUser1).ownerSetModularInterestSetter(
          OTHER_ADDRESS
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#setInterestSetterByMarketId', () => {
    it('should work normally', async () => {
      await adminRegistry.connect(core.governance).grantPermission(
        SET_INTEREST_SETTER_BY_MARKET_ID_SELECTOR,
        adminSetInterestSetter.address,
        core.hhUser4.address
      );

      await adminSetInterestSetter.connect(core.hhUser4).setInterestSetterByMarketId(
        core.marketIds.usdc,
        core.interestSetters.alwaysZeroInterestSetter.address
      );
      expect(await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.usdc)).to.equal(
        core.interestSetters.alwaysZeroInterestSetter.address
      );
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.hhUser4).setInterestSetterByMarketId(
          core.marketIds.usdc,
          ADDRESS_ZERO
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setModularInterestSetterByMarketId', () => {
    it('should work normally', async () => {
      await adminRegistry.connect(core.governance).grantPermission(
        SET_MODULAR_INTEREST_SETTER_BY_MARKET_ID_SELECTOR,
        adminSetInterestSetter.address,
        core.hhUser4.address
      );

      await core.dolomiteMargin.connect(core.governance).ownerSetInterestSetter(
        core.marketIds.usdc,
        core.interestSetters.alwaysZeroInterestSetter.address
      );
      await adminSetInterestSetter.connect(core.hhUser4).setModularInterestSetterByMarketId(
        core.marketIds.usdc
      );
      expect(await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.usdc)).to.equal(
        core.interestSetters.modularInterestSetter.address
      );
    });

    it('should fail when caller does not have permission', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.hhUser4).setModularInterestSetterByMarketId(
          core.marketIds.usdc
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setInterestSettingsByToken', () => {
    it('should work normally when called by trusted caller', async () => {
      await adminRegistry.connect(core.governance).grantPermission(
        SET_INTEREST_SETTINGS_BY_TOKEN_SELECTOR,
        adminSetInterestSetter.address,
        core.hhUser4.address
      );

      await adminSetInterestSetter.connect(core.hhUser4).setInterestSettingsByToken(
        core.tokens.usdc.address,
        parseEther('0.05'), // 5% lower optimal
        parseEther('0.10'), // 10% upper optimal
        parseEther('0.80'), // 80% optimal utilization
      );

      const settings = await core.interestSetters.modularInterestSetter.getSettingsByToken(
        core.tokens.usdc.address
      );
      expect(settings.lowerOptimalPercent).to.equal(parseEther('0.05'));
      expect(settings.upperOptimalPercent).to.equal(parseEther('0.10'));
      expect(settings.optimalUtilization).to.equal(parseEther('0.80'));
    });

    it('should fail when called by untrusted caller', async () => {
      await expectThrow(
        adminSetInterestSetter.connect(core.hhUser4).setInterestSettingsByToken(
          core.tokens.usdc.address,
          parseEther('0.00'),
          parseEther('0.00'),
          parseEther('0.10'),
        ),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser4.address.toLowerCase()}>`,
      );
    });
  });
});
