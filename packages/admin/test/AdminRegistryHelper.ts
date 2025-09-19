import { expect } from 'chai';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { AdminRegistry, AdminRegistry__factory, TestAdminRegistryHelper, TestAdminRegistryHelper__factory } from '../src/types';
import { createAdminRegistry, createAndUpgradeDolomiteRegistry } from 'packages/base/test/utils/dolomite';

const DO_SOMETHING_SELECTOR = '0x82692679';

describe('AdminRegistryHelper', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let adminRegistry: AdminRegistry;
  let adminRegistryHelper: TestAdminRegistryHelper;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 8_436_000,
    });

    adminRegistry = await createAdminRegistry(core);

    adminRegistryHelper = await createContractWithAbi<TestAdminRegistryHelper>(
      TestAdminRegistryHelper__factory.abi,
      TestAdminRegistryHelper__factory.bytecode,
      [adminRegistry.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await adminRegistryHelper.ADMIN_REGISTRY()).to.eq(adminRegistry.address);
    });
  });

  describe('#doSomething', () => {
    it('should work normally', async () => {
      await adminRegistry.connect(core.governance).grantPermission(
        DO_SOMETHING_SELECTOR,
        adminRegistryHelper.address,
        core.hhUser1.address
      );
      await adminRegistryHelper.connect(core.hhUser1).doSomething();

      await adminRegistry.connect(core.governance).revokePermission(
        DO_SOMETHING_SELECTOR,
        adminRegistryHelper.address,
        core.hhUser1.address,
      );
      await expectThrow(
        adminRegistryHelper.connect(core.hhUser1).doSomething(),
        `AdminRegistryHelper: Caller does not have permission <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
