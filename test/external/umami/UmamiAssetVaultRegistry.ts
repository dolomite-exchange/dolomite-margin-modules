import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { UmamiAssetVaultIsolationModeUnwrapperTraderV2, UmamiAssetVaultRegistry } from '../../../src/types';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';
import { expectEvent, expectThrow } from '../../../packages/base/test/utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../packages/base/test/utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('UmamiAssetVaultRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createUmamiAssetVaultRegistry(core);
    const userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    const factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      registry,
      core.umamiEcosystem!.glpUsdc,
      userVaultImplementation,
    );
    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, registry, factory);

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
