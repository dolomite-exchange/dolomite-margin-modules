import { expect } from 'chai';
import { ARBRegistry } from '../../../src/types';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';
import { expectThrow } from '../../../packages/base/test/utils/assertions';
import { createARBRegistry } from '../../utils/ecosystem-token-utils/arb';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../packages/base/test/utils/setup';

describe('ARBRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
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
