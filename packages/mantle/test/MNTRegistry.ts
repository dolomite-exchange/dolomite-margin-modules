import { expect } from 'chai';
import { MNTRegistry } from '../src/types';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createMNTRegistry } from './mnt-ecosystem-utils';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';

describe('MNTRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let registry: MNTRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.Mantle));
    registry = await createMNTRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.dolomiteRegistry.address,
          core.mantleRewardStation.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetMantleRewardStation', () => {
    it('should ownerSetMantleRewardStation variables properly', async () => {
      await registry.connect(core.governance).ownerSetMantleRewardStation(
        core.dolomiteRegistry.address,
      );

      expect(await registry.mantleRewardStation()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMantleRewardStation(
          core.dolomiteRegistry.address,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.addressLower}>`,
      );
    });

    it('should fail an invalid address is used', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMantleRewardStation(ADDRESS_ZERO),
        'MNTRegistry: Invalid reward station address',
      );
    });
  });
});
