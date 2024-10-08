import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { PendleGLPRegistry } from '../../src/types';
import { createPendleGLPRegistry } from '../pendle-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendleGLPRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let registry: PendleGLPRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createPendleGLPRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.pendleRouter()).to.equal(core.pendleEcosystem!.pendleRouter.address);
      expect(await registry.ptGlpMarket()).to.equal(core.pendleEcosystem!.glpMar2024.glpMarket.address);
      expect(await registry.ptGlpToken()).to.equal(core.pendleEcosystem!.glpMar2024.ptGlpToken.address);
      expect(await registry.ptOracle()).to.equal(core.pendleEcosystem!.glpMar2024.ptOracle.address);
      expect(await registry.syGlpToken()).to.equal(core.pendleEcosystem!.syGlpMar2024Token.address);
      expect(await registry.ytGlpToken()).to.equal(core.pendleEcosystem!.glpMar2024.ytGlpToken.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.pendleEcosystem!.pendleRouter.address,
          core.pendleEcosystem!.glpMar2024.glpMarket.address,
          core.pendleEcosystem!.glpMar2024.ptGlpToken.address,
          core.pendleEcosystem!.glpMar2024.ptOracle.address,
          core.pendleEcosystem!.syGlpMar2024Token.address,
          core.pendleEcosystem!.glpMar2024.ytGlpToken.address,
          core.dolomiteRegistry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetPendleRouter', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPendleRouter(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PendleRouterSet', {
        pendleRouter: OTHER_ADDRESS,
      });
      expect(await registry.pendleRouter()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPendleRouter(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPendleRouter(ZERO_ADDRESS),
        'PendleGLPRegistry: Invalid pendleRouter address',
      );
    });
  });

  describe('#ownerSetPtGlpMarket', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtGlpMarket(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtGlpMarketSet', {
        ptGlpMarket: OTHER_ADDRESS,
      });
      expect(await registry.ptGlpMarket()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtGlpMarket(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtGlpMarket(ZERO_ADDRESS),
        'PendleGLPRegistry: Invalid ptGlpMarket address',
      );
    });
  });

  describe('#ownerSetPtOracle', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtOracle(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtOracleSet', {
        ptOracle: OTHER_ADDRESS,
      });
      expect(await registry.ptOracle()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtOracle(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtOracle(ZERO_ADDRESS),
        'PendleGLPRegistry: Invalid ptOracle address',
      );
    });
  });

  describe('#ownerSetSyGlpToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetSyGlpToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SyGlpTokenSet', {
        syGLPToken: OTHER_ADDRESS,
      });
      expect(await registry.syGlpToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetSyGlpToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetSyGlpToken(ZERO_ADDRESS),
        'PendleGLPRegistry: Invalid syGlpToken address',
      );
    });
  });

  describe('#ownerSetPtGlpToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtGlpToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtGlpTokenSet', {
        ptGlpToken: OTHER_ADDRESS,
      });
      expect(await registry.ptGlpToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPtGlpToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPtGlpToken(ZERO_ADDRESS),
        'PendleGLPRegistry: Invalid ptGlpToken address',
      );
    });
  });

  describe('#ownerSetYtGlpToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetYtGlpToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'YtGlpTokenSet', {
        ytGlpToken: OTHER_ADDRESS,
      });
      expect(await registry.ytGlpToken()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetYtGlpToken(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetYtGlpToken(ZERO_ADDRESS),
        'PendleGLPRegistry: Invalid ytGlpToken address',
      );
    });
  });

  describe('#ownerSetDolomiteRegistry', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetDolomiteRegistry(core.dolomiteRegistry.address);
      await expectEvent(registry, result, 'DolomiteRegistrySet', {
        glpManager: core.dolomiteRegistry.address,
      });
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetDolomiteRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetDolomiteRegistry(ZERO_ADDRESS),
        'BaseRegistry: Invalid dolomiteRegistry',
      );
    });
  });
});
