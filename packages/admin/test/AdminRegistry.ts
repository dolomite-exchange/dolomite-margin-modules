import { expect } from 'chai';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminRegistry, AdminRegistry__factory } from '../src/types';

const TEST_SELECTOR = '0x12345678';
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const TEST_ROLE = '0x1234567800000000000000001234567812345678123456781234567812345678';

describe('AdminRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let adminRegistry: AdminRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 8_436_000,
    });

    adminRegistry = await createContractWithAbi<AdminRegistry>(
      AdminRegistry__factory.abi,
      AdminRegistry__factory.bytecode,
      [core.dolomiteMargin.address],
    );

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

  describe('#grantPermission', () => {
    it('should work normally', async () => {
      await adminRegistry.connect(core.governance).grantPermission(
        TEST_SELECTOR,
        OTHER_ADDRESS,
        core.hhUser1.address
      );

      expect(await adminRegistry.hasRole(TEST_ROLE, core.hhUser1.address)).to.be.true;
      expect(await adminRegistry.hasPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address)).to.be.true;
    });

    it('should fail when not called by dolomite margin owner', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).grantPermission(
          TEST_SELECTOR,
          OTHER_ADDRESS,
          core.hhUser1.address
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#revokePermission', () => {
    it('should work normally', async () => {
      await adminRegistry.connect(core.governance).grantPermission(
        TEST_SELECTOR,
        OTHER_ADDRESS,
        core.hhUser1.address
      );
      expect(await adminRegistry.hasPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address)).to.be.true;

      await adminRegistry.connect(core.governance).revokePermission(
        TEST_SELECTOR,
        OTHER_ADDRESS,
        core.hhUser1.address
      );
      expect(await adminRegistry.hasPermission(TEST_SELECTOR, OTHER_ADDRESS, core.hhUser1.address)).to.be.false;
      expect(await adminRegistry.hasRole(TEST_ROLE, core.hhUser1.address)).to.be.false;
    });

    it('should fail when not called by dolomite margin owner', async () => {
      await expectThrow(
        adminRegistry.connect(core.hhUser1).revokePermission(
          TEST_SELECTOR,
          OTHER_ADDRESS,
          core.hhUser1.address
        ),
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
