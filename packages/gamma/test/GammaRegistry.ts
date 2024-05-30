import { expect } from 'chai';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GammaRegistry } from '../src/types';
import { createGammaRegistry } from './gamma-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GammaRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let registry: GammaRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createGammaRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.gammaPositionManager()).to.equal(core.gammaEcosystem.positionManager.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.gammaEcosystem.positionManager.address,
          core.gammaEcosystem.deltaSwapRouter.address,
          core.dolomiteRegistry.address
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetGammaPositionManager', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetGammaPositionManager(
        OTHER_ADDRESS
      );
      await expectEvent(registry, result, 'GammaPositionManagerSet', {
        gammaPositionManager: OTHER_ADDRESS
      });
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetGammaPositionManager(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetGammaPositionManager(ADDRESS_ZERO),
        'GammaRegistry: Invalid gammaPositionManager',
      );
    });
  });

  describe('#ownerSetDeltaSwapRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDeltaSwapRouter(
        OTHER_ADDRESS
      );
      await expectEvent(registry, result, 'DeltaSwapRouterSet', {
        deltaSwapRouter: OTHER_ADDRESS
      });
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetDeltaSwapRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetDeltaSwapRouter(ADDRESS_ZERO),
        'GammaRegistry: Invalid deltaSwapRouter',
      );
    });
  });
});
