import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { UmamiAssetVaultRegistry } from '../src/types';
import { createUmamiAssetVaultRegistry } from './umami-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('UmamiAssetVaultRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let registry: UmamiAssetVaultRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createUmamiAssetVaultRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.storageViewer()).to.equal(core.umamiEcosystem!.storageViewer.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.umamiEcosystem!.storageViewer.address,
          core.dolomiteRegistry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetStorageViewer', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetStorageViewer(
        core.umamiEcosystem!.storageViewer.address,
      );
      await expectEvent(registry, result, 'StorageViewerSet', {
        storageViewer: core.umamiEcosystem!.storageViewer.address,
      });
      expect(await registry.storageViewer()).to.equal(core.umamiEcosystem!.storageViewer.address);
    });

    it('should fail if storageViewer is invalid', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetStorageViewer(OTHER_ADDRESS),
        `ValidationLib: Call to target failed <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetStorageViewer(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetStorageViewer(ZERO_ADDRESS),
        'UmamiAssetVaultRegistry: Invalid storageViewer address',
      );
    });
  });
});
