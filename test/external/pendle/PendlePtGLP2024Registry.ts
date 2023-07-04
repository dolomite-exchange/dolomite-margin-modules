import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { PendlePtGLP2024Registry } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { createPendlePtGLP2024Registry } from '../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtGLP2024Registry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: PendlePtGLP2024Registry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createPendlePtGLP2024Registry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.pendleRouter()).to.equal(core.pendleEcosystem!.pendleRouter.address);
      expect(await registry.ptGlpMarket()).to.equal(core.pendleEcosystem!.ptGlpMarket.address);
      expect(await registry.ptGlpToken()).to.equal(core.pendleEcosystem!.ptGlpToken.address);
      expect(await registry.ptOracle()).to.equal(core.pendleEcosystem!.ptOracle.address);
      expect(await registry.syGlpToken()).to.equal(core.pendleEcosystem!.syGlpToken.address);
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
        'PendlePtGLP2024Registry: Invalid pendleRouter address',
      );
    });
  });

  describe('#ownerSetPtGlpMarket', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtGlpMarket(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtGlpMarketSet', {
        plvGlpToken: OTHER_ADDRESS,
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
        'PendlePtGLP2024Registry: Invalid ptGlpMarket address',
      );
    });
  });

  describe('#ownerSetPtGlpToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtGlpToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtGlpTokenSet', {
        glp: OTHER_ADDRESS,
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
        'PendlePtGLP2024Registry: Invalid ptGlpToken address',
      );
    });
  });

  describe('#ownerSetPtOracle', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPtOracle(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PtOracleSet', {
        glpManager: OTHER_ADDRESS,
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
        'PendlePtGLP2024Registry: Invalid ptOracle address',
      );
    });
  });

  describe('#ownerSetSyGlpToken', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetSyGlpToken(OTHER_ADDRESS);
      await expectEvent(registry, result, 'SyGlpTokenSet', {
        glpManager: OTHER_ADDRESS,
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
        'PendlePtGLP2024Registry: Invalid syGlpToken address',
      );
    });
  });
});
