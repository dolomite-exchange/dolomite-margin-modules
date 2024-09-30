import { expect } from 'chai';
import { BerachainRewardsRegistry } from '../src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createBerachainRewardsRegistry } from './berachain-ecosystem-utils';

describe('BerachainRewardsRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });
    registry = await createBerachainRewardsRegistry(core);

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
