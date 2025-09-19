import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createAdminRegistry } from 'packages/base/test/utils/dolomite';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminRegistry } from '../src/types';

const DEFAULT_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';

const ADMIN_SELECTOR = '0x11111111';
const TEST_SELECTOR = '0x12345678';
const TEST_SELECTOR_2 = '0x87654321';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

const TEST_ROLE = '0x1234567800000000000000001234567812345678123456781234567812345678';
const ADMIN_ROLE = '0x1111111100000000000000001234567812345678123456781234567812345678';

describe('AdminRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let adminRegistry: AdminRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 8_436_000,
    });

    adminRegistry = await createAdminRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminRegistry.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#initialize', () => {
    it('should fail if already initialized', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).initialize(),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#grantRole', () => {
    it('should always fail', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).grantRole(DEFAULT_ROLE, core.gnosisSafeAddress),
        'AdminRegistry: Not implemented',
      );
    });
  });

  describe('#revokeRole', () => {
    it('should always fail', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).revokeRole(DEFAULT_ROLE, core.gnosisSafeAddress),
        'AdminRegistry: Not implemented',
      );
    });
  });

  describe('#renounceRole', () => {
    it('should always fail', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).renounceRole(DEFAULT_ROLE, core.gnosisSafeAddress),
        'AdminRegistry: Not implemented',
      );
    });
  });

  describe('#grantPermission', () => {
    it('should work normally', async () => {
      await adminRegistry.connect(core.governance).grantPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address);

      expect(await adminRegistry.hasRole(TEST_ROLE, core.hhUser1.address)).to.be.true;
      expect(await adminRegistry.hasPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address)).to.be.true;
    });

    it('should work normally for admin selector', async () => {
      await adminRegistry.connect(core.governance).grantPermission(ADMIN_SELECTOR, OTHER_ADDRESS, core.hhUser1.address);

      expect(await adminRegistry.hasRole(ADMIN_ROLE, core.hhUser1.address)).to.be.true;
      expect(await adminRegistry.hasPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address)).to.be.true;
      expect(await adminRegistry.hasPermission(TEST_SELECTOR_2, OTHER_ADDRESS, core.hhUser1.address)).to.be.true;
    });

    it('should fail when not called by dolomite margin owner', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).grantPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#revokePermission', () => {
    it('should work normally', async () => {
      await adminRegistry.connect(core.governance).grantPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address);
      expect(await adminRegistry.hasPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address)).to.be.true;

      await adminRegistry.connect(core.governance).revokePermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address);
      expect(await adminRegistry.hasPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address)).to.be.false;
      expect(await adminRegistry.hasRole(TEST_ROLE, core.hhUser1.address)).to.be.false;
    });

    it('should fail when not called by dolomite margin owner', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).revokePermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#grantRole', () => {
    it('should fail', async () => {
      await expectThrow(adminRegistry.connect(core.governance).grantRole(TEST_ROLE, core.hhUser1.address));
      await expectThrow(adminRegistry.connect(core.hhUser1).grantRole(TEST_ROLE, core.hhUser1.address));
    });
  });

  describe('#revokeRole', () => {
    it('should fail', async () => {
      await expectThrow(adminRegistry.connect(core.governance).revokeRole(TEST_ROLE, core.hhUser1.address));
      await expectThrow(adminRegistry.connect(core.hhUser1).revokeRole(TEST_ROLE, core.hhUser1.address));
    });
  });

  describe('#role', () => {
    it('should return correct role for given selector and contract', async () => {
      expect(await adminRegistry.role(TEST_SELECTOR, OTHER_ADDRESS)).to.eq(TEST_ROLE);
    });
  });
});
