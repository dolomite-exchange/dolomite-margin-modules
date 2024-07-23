import { expect } from 'chai';
import { ARBRegistry } from '../src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createARBRegistry } from './mnt-ecosystem-utils';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';

describe('ARBRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let registry: ARBRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createARBRegistry(core);

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
        registry.initialize(core.dolomiteRegistry.address),
        'Initializable: contract is already initialized',
      );
    });
  });
});
