import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { UmamiAssetVaultIsolationModeUnwrapperTraderV2, UmamiAssetVaultRegistry } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('UmamiAssetVaultRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 104861700,
      network: Network.ArbitrumOne,
    });
    registry = await createUmamiAssetVaultRegistry(core);
    const userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    const factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      registry,
      core.umamiEcosystem!.umUsdc,
      core.usdc,
      userVaultImplementation,
    );
    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, registry, factory);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.whitelist()).to.equal(core.umamiEcosystem!.whitelist.address);
    });
  });

  describe('#ownerSetWhitelist', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetWhitelist(OTHER_ADDRESS);
      await expectEvent(registry, result, 'GlpAdapterSet', {
        glpAdapter: OTHER_ADDRESS,
      });
      expect(await registry.whitelist()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetWhitelist(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetWhitelist(ZERO_ADDRESS),
        'UmamiAssetVaultRegistry: Invalid whitelist address',
      );
    });
  });
});
